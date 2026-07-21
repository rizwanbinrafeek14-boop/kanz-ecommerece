<?php
/**
 * B2B trade accounts: adds Company Name / CR Number / VAT Number to
 * registration, flags the account "Business" vs "Individual", and puts an
 * admin-approval step in front of business accounts (see kc_b2b_status meta:
 * pending -> approved/rejected) so you can vet each company before granting
 * trade pricing. Trade-tier pricing itself is a matter of installing a
 * dedicated pricing plugin (e.g. "B2B King" or "Wholesale Suite") once you
 * know your tiers — this module only handles the account/identity side.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/* ------------------------------------------------------------------------
 * Registration form fields
 * ---------------------------------------------------------------------- */
function kc_registration_fields() {
	$account_type = isset( $_POST['kc_account_type'] ) ? sanitize_text_field( wp_unslash( $_POST['kc_account_type'] ) ) : 'individual';
	?>
	<div class="form-row">
		<label><?php esc_html_e( 'Account type', 'kanz-corner' ); ?></label>
		<div style="display:flex;gap:20px;margin-top:6px">
			<label style="display:flex;align-items:center;gap:6px;font-weight:500">
				<input type="radio" name="kc_account_type" value="individual" <?php checked( $account_type, 'individual' ); ?>>
				<?php esc_html_e( 'Individual', 'kanz-corner' ); ?>
			</label>
			<label style="display:flex;align-items:center;gap:6px;font-weight:500">
				<input type="radio" name="kc_account_type" value="business" <?php checked( $account_type, 'business' ); ?>>
				<?php esc_html_e( 'Business / Trade account', 'kanz-corner' ); ?>
			</label>
		</div>
	</div>

	<div id="kc-business-fields" style="<?php echo 'business' === $account_type ? '' : 'display:none'; ?>">
		<div class="form-row">
			<label for="kc_company_name"><?php esc_html_e( 'Company name', 'kanz-corner' ); ?></label>
			<input type="text" name="kc_company_name" id="kc_company_name" value="<?php echo esc_attr( $_POST['kc_company_name'] ?? '' ); ?>">
		</div>
		<div class="form-grid-2">
			<div class="form-row">
				<label for="kc_cr_number"><?php esc_html_e( 'Commercial Registration (CR) number', 'kanz-corner' ); ?></label>
				<input type="text" name="kc_cr_number" id="kc_cr_number" value="<?php echo esc_attr( $_POST['kc_cr_number'] ?? '' ); ?>">
			</div>
			<div class="form-row">
				<label for="kc_vat_number"><?php esc_html_e( 'VAT registration number', 'kanz-corner' ); ?></label>
				<input type="text" name="kc_vat_number" id="kc_vat_number" value="<?php echo esc_attr( $_POST['kc_vat_number'] ?? '' ); ?>">
			</div>
		</div>
		<p class="hint"><?php esc_html_e( 'Business accounts are reviewed by our team before trade pricing is enabled. You can still browse and use Request-a-Quote immediately.', 'kanz-corner' ); ?></p>
	</div>

	<script>
	(function(){
		var radios = document.querySelectorAll('input[name="kc_account_type"]');
		var panel = document.getElementById('kc-business-fields');
		if (!radios.length || !panel) return;
		radios.forEach(function(r){
			r.addEventListener('change', function(){
				panel.style.display = (r.value === 'business' && r.checked) ? '' : (document.querySelector('input[name="kc_account_type"]:checked').value === 'business' ? '' : 'none');
			});
		});
	})();
	</script>
	<?php
}
add_action( 'woocommerce_register_form', 'kc_registration_fields' );

function kc_validate_registration_fields( $errors, $username, $email ) {
	if ( isset( $_POST['kc_account_type'] ) && 'business' === $_POST['kc_account_type'] ) {
		if ( empty( $_POST['kc_company_name'] ) ) {
			$errors->add( 'kc_company_name_error', __( 'Please enter your company name for a business account.', 'kanz-corner' ) );
		}
		if ( empty( $_POST['kc_cr_number'] ) ) {
			$errors->add( 'kc_cr_number_error', __( 'Please enter your Commercial Registration (CR) number.', 'kanz-corner' ) );
		}
	}
	return $errors;
}
add_filter( 'woocommerce_registration_errors', 'kc_validate_registration_fields', 10, 3 );

function kc_save_registration_fields( $customer_id ) {
	$account_type = isset( $_POST['kc_account_type'] ) && 'business' === $_POST['kc_account_type'] ? 'business' : 'individual';
	update_user_meta( $customer_id, 'kc_account_type', $account_type );

	if ( 'business' === $account_type ) {
		update_user_meta( $customer_id, 'kc_company_name', sanitize_text_field( wp_unslash( $_POST['kc_company_name'] ?? '' ) ) );
		update_user_meta( $customer_id, 'kc_cr_number', sanitize_text_field( wp_unslash( $_POST['kc_cr_number'] ?? '' ) ) );
		update_user_meta( $customer_id, 'kc_vat_number', sanitize_text_field( wp_unslash( $_POST['kc_vat_number'] ?? '' ) ) );
		update_user_meta( $customer_id, 'kc_b2b_status', 'pending' );

		kc_notify_admin_new_business_account( $customer_id );
	}
}
add_action( 'woocommerce_created_customer', 'kc_save_registration_fields' );

function kc_notify_admin_new_business_account( $customer_id ) {
	$user    = get_userdata( $customer_id );
	$company = get_user_meta( $customer_id, 'kc_company_name', true );
	$subject = sprintf(
		/* translators: %s: company name */
		__( 'New business account pending review: %s', 'kanz-corner' ),
		$company
	);
	$body = sprintf(
		/* translators: 1: company, 2: name, 3: email, 4: CR number, 5: admin URL */
		__( "A new business account registered and is awaiting approval.\n\nCompany: %1\$s\nContact: %2\$s (%3\$s)\nCR Number: %4\$s\n\nReview it here: %5\$s", 'kanz-corner' ),
		$company,
		$user->display_name,
		$user->user_email,
		get_user_meta( $customer_id, 'kc_cr_number', true ),
		admin_url( 'user-edit.php?user_id=' . $customer_id )
	);
	wp_mail( get_option( 'admin_email' ), $subject, $body );
}

/* ------------------------------------------------------------------------
 * Admin: show account type / approval status in the Users list + profile
 * ---------------------------------------------------------------------- */
function kc_user_list_columns( $columns ) {
	$columns['kc_account_type'] = __( 'Account Type', 'kanz-corner' );
	return $columns;
}
add_filter( 'manage_users_columns', 'kc_user_list_columns' );

function kc_user_list_column_content( $value, $column_name, $user_id ) {
	if ( 'kc_account_type' !== $column_name ) {
		return $value;
	}
	$type = get_user_meta( $user_id, 'kc_account_type', true );
	if ( 'business' !== $type ) {
		return esc_html__( 'Individual', 'kanz-corner' );
	}
	$status = get_user_meta( $user_id, 'kc_b2b_status', true );
	$company = get_user_meta( $user_id, 'kc_company_name', true );
	$labels = array(
		'pending'  => __( 'Pending review', 'kanz-corner' ),
		'approved' => __( 'Approved', 'kanz-corner' ),
		'rejected' => __( 'Rejected', 'kanz-corner' ),
	);
	return esc_html( $company ) . '<br><strong>' . esc_html( $labels[ $status ] ?? $status ) . '</strong>';
}
add_filter( 'manage_users_custom_column', 'kc_user_list_column_content', 10, 3 );

function kc_user_profile_b2b_fields( $user ) {
	if ( 'business' !== get_user_meta( $user->ID, 'kc_account_type', true ) ) {
		return;
	}
	wp_nonce_field( 'kc_b2b_profile_save', 'kc_b2b_profile_nonce' );
	$status = get_user_meta( $user->ID, 'kc_b2b_status', true ) ?: 'pending';
	?>
	<h2><?php esc_html_e( 'Kanz Corner — Business Account', 'kanz-corner' ); ?></h2>
	<table class="form-table">
		<tr>
			<th><?php esc_html_e( 'Company name', 'kanz-corner' ); ?></th>
			<td><?php echo esc_html( get_user_meta( $user->ID, 'kc_company_name', true ) ); ?></td>
		</tr>
		<tr>
			<th><?php esc_html_e( 'CR number', 'kanz-corner' ); ?></th>
			<td><?php echo esc_html( get_user_meta( $user->ID, 'kc_cr_number', true ) ); ?></td>
		</tr>
		<tr>
			<th><?php esc_html_e( 'VAT number', 'kanz-corner' ); ?></th>
			<td><?php echo esc_html( get_user_meta( $user->ID, 'kc_vat_number', true ) ); ?></td>
		</tr>
		<tr>
			<th><label for="kc_b2b_status"><?php esc_html_e( 'Approval status', 'kanz-corner' ); ?></label></th>
			<td>
				<select name="kc_b2b_status" id="kc_b2b_status">
					<option value="pending" <?php selected( $status, 'pending' ); ?>><?php esc_html_e( 'Pending review', 'kanz-corner' ); ?></option>
					<option value="approved" <?php selected( $status, 'approved' ); ?>><?php esc_html_e( 'Approved', 'kanz-corner' ); ?></option>
					<option value="rejected" <?php selected( $status, 'rejected' ); ?>><?php esc_html_e( 'Rejected', 'kanz-corner' ); ?></option>
				</select>
			</td>
		</tr>
	</table>
	<?php
}
add_action( 'show_user_profile', 'kc_user_profile_b2b_fields' );
add_action( 'edit_user_profile', 'kc_user_profile_b2b_fields' );

function kc_save_user_profile_b2b_fields( $user_id ) {
	if ( ! current_user_can( 'edit_user', $user_id ) ) {
		return;
	}
	if ( ! isset( $_POST['kc_b2b_profile_nonce'] ) || ! wp_verify_nonce( $_POST['kc_b2b_profile_nonce'], 'kc_b2b_profile_save' ) ) {
		return;
	}
	if ( isset( $_POST['kc_b2b_status'] ) ) {
		$new_status = sanitize_key( $_POST['kc_b2b_status'] );
		$old_status = get_user_meta( $user_id, 'kc_b2b_status', true );
		update_user_meta( $user_id, 'kc_b2b_status', $new_status );

		if ( 'approved' === $new_status && 'approved' !== $old_status ) {
			$user = get_userdata( $user_id );
			wp_mail(
				$user->user_email,
				__( 'Your Kanz Corner trade account is approved', 'kanz-corner' ),
				sprintf( __( "Hi %s,\n\nYour business account has been approved. You can now sign in for trade pricing and order history.\n\n— Kanz Corner Trading", 'kanz-corner' ), $user->display_name )
			);
		}
	}
}
add_action( 'personal_options_update', 'kc_save_user_profile_b2b_fields' );
add_action( 'edit_user_profile_update', 'kc_save_user_profile_b2b_fields' );

/* ------------------------------------------------------------------------
 * My Account: show the customer their own business account status
 * ---------------------------------------------------------------------- */
function kc_my_account_b2b_notice() {
	$user_id = get_current_user_id();
	if ( ! $user_id || 'business' !== get_user_meta( $user_id, 'kc_account_type', true ) ) {
		return;
	}
	$status = get_user_meta( $user_id, 'kc_b2b_status', true );
	$company = get_user_meta( $user_id, 'kc_company_name', true );
	if ( 'approved' === $status ) {
		$badge = '<span class="badge badge-stock">' . esc_html__( 'Approved trade account', 'kanz-corner' ) . '</span>';
	} elseif ( 'rejected' === $status ) {
		$badge = '<span class="badge" style="background:#FBEEEC;color:#7E1A22">' . esc_html__( 'Not approved — contact us', 'kanz-corner' ) . '</span>';
	} else {
		$badge = '<span class="badge badge-quote">' . esc_html__( 'Pending review', 'kanz-corner' ) . '</span>';
	}
	echo '<p style="margin-bottom:16px">' . esc_html( $company ) . ' &middot; ' . $badge . '</p>'; // phpcs:ignore
}
add_action( 'woocommerce_before_account_navigation', 'kc_my_account_b2b_notice' );
