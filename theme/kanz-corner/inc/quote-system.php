<?php
/**
 * Request-a-Quote system.
 *
 * The item list itself lives client-side in localStorage (assets/js/main.js)
 * so guests can build a list without an account. When they submit the form
 * rendered by the [kc_quote_form] shortcode, JS copies that list into a
 * hidden "items_json" field and the whole thing posts once to admin-post.php.
 * We store it as a kc_quote_request post and email the sales team — the
 * "email notification, manual follow-up" workflow chosen for launch.
 * (See docs/ADMIN-GUIDE.md for how to process incoming quotes, and the note
 * there on upgrading to in-dashboard PDF quotes later if needed.)
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/* ------------------------------------------------------------------------
 * 1. Custom post type
 * ---------------------------------------------------------------------- */
function kc_register_quote_cpt() {
	register_post_type( 'kc_quote_request', array(
		'labels' => array(
			'name'          => __( 'Quote Requests', 'kanz-corner' ),
			'singular_name' => __( 'Quote Request', 'kanz-corner' ),
			'all_items'     => __( 'Quote Requests', 'kanz-corner' ),
		),
		'public'             => false,
		'show_ui'            => true,
		'show_in_menu'       => true,
		'menu_icon'          => 'dashicons-media-document',
		'capability_type'    => 'page',
		'supports'           => array( 'title' ),
		'menu_position'      => 26,
	) );

	register_post_status( 'kc-new', array(
		'label'                     => _x( 'New', 'quote status', 'kanz-corner' ),
		'public'                    => false,
		'internal'                  => true,
		'show_in_admin_all_list'    => true,
		'show_in_admin_status_list' => true,
		/* translators: %s: number of new quotes */
		'label_count'               => _n_noop( 'New <span class="count">(%s)</span>', 'New <span class="count">(%s)</span>', 'kanz-corner' ),
	) );
	register_post_status( 'kc-quoted', array(
		'label'                     => _x( 'Quoted', 'quote status', 'kanz-corner' ),
		'public'                    => false,
		'internal'                  => true,
		'show_in_admin_all_list'    => true,
		'show_in_admin_status_list' => true,
		'label_count'               => _n_noop( 'Quoted <span class="count">(%s)</span>', 'Quoted <span class="count">(%s)</span>', 'kanz-corner' ),
	) );
	register_post_status( 'kc-won', array(
		'label'                     => _x( 'Won', 'quote status', 'kanz-corner' ),
		'public'                    => false,
		'internal'                  => true,
		'show_in_admin_all_list'    => true,
		'show_in_admin_status_list' => true,
		'label_count'               => _n_noop( 'Won <span class="count">(%s)</span>', 'Won <span class="count">(%s)</span>', 'kanz-corner' ),
	) );
	register_post_status( 'kc-lost', array(
		'label'                     => _x( 'Lost', 'quote status', 'kanz-corner' ),
		'public'                    => false,
		'internal'                  => true,
		'show_in_admin_all_list'    => true,
		'show_in_admin_status_list' => true,
		'label_count'               => _n_noop( 'Lost <span class="count">(%s)</span>', 'Lost <span class="count">(%s)</span>', 'kanz-corner' ),
	) );
}
add_action( 'init', 'kc_register_quote_cpt' );

/* ------------------------------------------------------------------------
 * 2. Admin list columns + status dropdown + detail meta box
 * ---------------------------------------------------------------------- */
function kc_quote_admin_columns( $columns ) {
	$columns = array(
		'cb'         => $columns['cb'],
		'title'      => __( 'Reference', 'kanz-corner' ),
		'kc_contact' => __( 'Contact', 'kanz-corner' ),
		'kc_items'   => __( 'Items', 'kanz-corner' ),
		'kc_status'  => __( 'Status', 'kanz-corner' ),
		'date'       => $columns['date'],
	);
	return $columns;
}
add_filter( 'manage_kc_quote_request_posts_columns', 'kc_quote_admin_columns' );

function kc_quote_admin_column_content( $column, $post_id ) {
	switch ( $column ) {
		case 'kc_contact':
			$name    = get_post_meta( $post_id, '_kc_name', true );
			$email   = get_post_meta( $post_id, '_kc_email', true );
			$phone   = get_post_meta( $post_id, '_kc_phone', true );
			$company = get_post_meta( $post_id, '_kc_company', true );
			echo esc_html( $name );
			if ( $company ) {
				echo ' &middot; ' . esc_html( $company );
			}
			echo '<br><a href="mailto:' . esc_attr( $email ) . '">' . esc_html( $email ) . '</a>';
			if ( $phone ) {
				echo ' &middot; ' . esc_html( $phone );
			}
			break;
		case 'kc_items':
			$items = json_decode( get_post_meta( $post_id, '_kc_items', true ), true );
			echo is_array( $items ) ? esc_html( count( $items ) ) : '0';
			break;
		case 'kc_status':
			$status = get_post_status( $post_id );
			$labels = array(
				'kc-new'    => __( 'New', 'kanz-corner' ),
				'kc-quoted' => __( 'Quoted', 'kanz-corner' ),
				'kc-won'    => __( 'Won', 'kanz-corner' ),
				'kc-lost'   => __( 'Lost', 'kanz-corner' ),
			);
			echo '<strong>' . esc_html( $labels[ $status ] ?? $status ) . '</strong>';
			break;
	}
}
add_action( 'manage_kc_quote_request_posts_custom_column', 'kc_quote_admin_column_content', 10, 2 );

function kc_quote_detail_meta_box() {
	add_meta_box( 'kc_quote_details', __( 'Quote Details', 'kanz-corner' ), 'kc_render_quote_detail_meta_box', 'kc_quote_request', 'normal', 'high' );
	add_meta_box( 'kc_quote_status', __( 'Status', 'kanz-corner' ), 'kc_render_quote_status_meta_box', 'kc_quote_request', 'side', 'high' );
}
add_action( 'add_meta_boxes', 'kc_quote_detail_meta_box' );

function kc_render_quote_detail_meta_box( $post ) {
	$fields = array(
		'_kc_name'    => __( 'Name', 'kanz-corner' ),
		'_kc_company' => __( 'Company', 'kanz-corner' ),
		'_kc_email'   => __( 'Email', 'kanz-corner' ),
		'_kc_phone'   => __( 'Phone', 'kanz-corner' ),
		'_kc_message' => __( 'Project details', 'kanz-corner' ),
	);
	echo '<table class="form-table">';
	foreach ( $fields as $key => $label ) {
		$value = get_post_meta( $post->ID, $key, true );
		echo '<tr><th style="width:160px">' . esc_html( $label ) . '</th><td>' . nl2br( esc_html( $value ) ) . '</td></tr>';
	}
	echo '</table>';

	$items = json_decode( get_post_meta( $post->ID, '_kc_items', true ), true );
	echo '<h3>' . esc_html__( 'Requested items', 'kanz-corner' ) . '</h3>';
	if ( is_array( $items ) && count( $items ) ) {
		echo '<table class="widefat striped"><thead><tr><th>' . esc_html__( 'Product', 'kanz-corner' ) . '</th><th>' . esc_html__( 'Category', 'kanz-corner' ) . '</th></tr></thead><tbody>';
		foreach ( $items as $item ) {
			echo '<tr><td>' . esc_html( $item['name'] ?? '' ) . '</td><td>' . esc_html( $item['category'] ?? '' ) . '</td></tr>';
		}
		echo '</tbody></table>';
	} else {
		echo '<p>' . esc_html__( 'No line items were attached — the customer contacted you via the general quote form.', 'kanz-corner' ) . '</p>';
	}
}

function kc_render_quote_status_meta_box( $post ) {
	wp_nonce_field( 'kc_quote_status_save', 'kc_quote_status_nonce' );
	$statuses = array(
		'kc-new'    => __( 'New', 'kanz-corner' ),
		'kc-quoted' => __( 'Quoted', 'kanz-corner' ),
		'kc-won'    => __( 'Won', 'kanz-corner' ),
		'kc-lost'   => __( 'Lost', 'kanz-corner' ),
	);
	echo '<select name="kc_quote_status" style="width:100%">';
	foreach ( $statuses as $value => $label ) {
		printf( '<option value="%1$s" %2$s>%3$s</option>', esc_attr( $value ), selected( $post->post_status, $value, false ), esc_html( $label ) );
	}
	echo '</select>';
}

function kc_save_quote_status( $post_id ) {
	if ( ! isset( $_POST['kc_quote_status_nonce'] ) || ! wp_verify_nonce( $_POST['kc_quote_status_nonce'], 'kc_quote_status_save' ) ) {
		return;
	}
	if ( ! current_user_can( 'edit_post', $post_id ) || 'kc_quote_request' !== get_post_type( $post_id ) ) {
		return;
	}
	if ( isset( $_POST['kc_quote_status'] ) ) {
		remove_action( 'save_post_kc_quote_request', 'kc_save_quote_status' );
		wp_update_post( array( 'ID' => $post_id, 'post_status' => sanitize_key( $_POST['kc_quote_status'] ) ) );
		add_action( 'save_post_kc_quote_request', 'kc_save_quote_status' );
	}
}
add_action( 'save_post_kc_quote_request', 'kc_save_quote_status' );

/* ------------------------------------------------------------------------
 * 3. Front-end shortcode: [kc_quote_form]
 * ---------------------------------------------------------------------- */
function kc_quote_form_shortcode() {
	ob_start();
	$success = isset( $_GET['kc_quote'] ) && 'sent' === $_GET['kc_quote'];
	?>
	<?php if ( $success ) : ?>
		<div class="badge badge-stock" style="margin-bottom:24px;padding:14px 20px;font-size:14px">
			<?php esc_html_e( 'Thank you — your quote request has been received. Our team will reply within 24 hours.', 'kanz-corner' ); ?>
		</div>
	<?php endif; ?>

	<div id="quote-form-empty-state" style="margin-bottom:16px;color:var(--text-muted);font-size:14px"></div>

	<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" id="kc-quote-form">
		<input type="hidden" name="action" value="kc_submit_quote_request">
		<input type="hidden" name="items_json" id="kc-items-json" value="[]">
		<?php wp_nonce_field( 'kc_submit_quote', 'kc_quote_nonce_field' ); ?>

		<div class="form-grid-2">
			<div class="form-row">
				<label for="kc-q-name"><?php esc_html_e( 'Full name', 'kanz-corner' ); ?> *</label>
				<input type="text" id="kc-q-name" name="name" required>
			</div>
			<div class="form-row">
				<label for="kc-q-company"><?php esc_html_e( 'Company (optional)', 'kanz-corner' ); ?></label>
				<input type="text" id="kc-q-company" name="company">
			</div>
			<div class="form-row">
				<label for="kc-q-email"><?php esc_html_e( 'Email', 'kanz-corner' ); ?> *</label>
				<input type="email" id="kc-q-email" name="email" required>
			</div>
			<div class="form-row">
				<label for="kc-q-phone"><?php esc_html_e( 'Phone / WhatsApp', 'kanz-corner' ); ?> *</label>
				<input type="tel" id="kc-q-phone" name="phone" required>
			</div>
		</div>
		<div class="form-row">
			<label for="kc-q-message"><?php esc_html_e( 'Project details, quantities, delivery location', 'kanz-corner' ); ?></label>
			<textarea id="kc-q-message" name="message" rows="4"></textarea>
		</div>
		<button type="submit" class="btn btn-primary btn-block"><?php esc_html_e( 'Send Quote Request', 'kanz-corner' ); ?></button>
	</form>

	<script>
	(function(){
		var form = document.getElementById('kc-quote-form');
		if (!form) return;
		form.addEventListener('submit', function(){
			try {
				var list = JSON.parse(localStorage.getItem('kc_quote_list')) || [];
				document.getElementById('kc-items-json').value = JSON.stringify(list);
			} catch (e) {}
		});
		try {
			var list = JSON.parse(localStorage.getItem('kc_quote_list')) || [];
			var empty = document.getElementById('quote-form-empty-state');
			if (empty) {
				empty.textContent = list.length
					? list.length + ' item(s) from your quote list will be attached to this request.'
					: 'No items attached — that\'s fine, just describe what you need below.';
			}
		} catch (e) {}
	})();
	</script>
	<?php
	return ob_get_clean();
}
add_shortcode( 'kc_quote_form', 'kc_quote_form_shortcode' );

/* ------------------------------------------------------------------------
 * 4. Form handler
 * ---------------------------------------------------------------------- */
function kc_handle_quote_submission() {
	if ( ! isset( $_POST['kc_quote_nonce_field'] ) || ! wp_verify_nonce( $_POST['kc_quote_nonce_field'], 'kc_submit_quote' ) ) {
		wp_die( esc_html__( 'Security check failed. Please go back and try again.', 'kanz-corner' ) );
	}

	$name    = sanitize_text_field( wp_unslash( $_POST['name'] ?? '' ) );
	$company = sanitize_text_field( wp_unslash( $_POST['company'] ?? '' ) );
	$email   = sanitize_email( wp_unslash( $_POST['email'] ?? '' ) );
	$phone   = sanitize_text_field( wp_unslash( $_POST['phone'] ?? '' ) );
	$message = sanitize_textarea_field( wp_unslash( $_POST['message'] ?? '' ) );

	if ( empty( $name ) || ! is_email( $email ) || empty( $phone ) ) {
		wp_safe_redirect( add_query_arg( 'kc_quote', 'error', wp_get_referer() ?: home_url( '/' ) ) );
		exit;
	}

	$items_raw = isset( $_POST['items_json'] ) ? wp_unslash( $_POST['items_json'] ) : '[]';
	$items     = json_decode( $items_raw, true );
	if ( ! is_array( $items ) ) {
		$items = array();
	}
	// Re-sanitize every field of every item — this JSON comes straight from
	// client-side localStorage, i.e. untrusted user input.
	$clean_items = array();
	foreach ( $items as $item ) {
		$clean_items[] = array(
			'id'       => isset( $item['id'] ) ? sanitize_text_field( $item['id'] ) : '',
			'name'     => isset( $item['name'] ) ? sanitize_text_field( $item['name'] ) : '',
			'category' => isset( $item['category'] ) ? sanitize_text_field( $item['category'] ) : '',
		);
	}

	$post_id = wp_insert_post( array(
		'post_type'   => 'kc_quote_request',
		'post_title'  => sprintf( '%s — %s', $name, gmdate( 'Y-m-d H:i' ) ),
		'post_status' => 'kc-new',
	) );

	if ( $post_id && ! is_wp_error( $post_id ) ) {
		update_post_meta( $post_id, '_kc_name', $name );
		update_post_meta( $post_id, '_kc_company', $company );
		update_post_meta( $post_id, '_kc_email', $email );
		update_post_meta( $post_id, '_kc_phone', $phone );
		update_post_meta( $post_id, '_kc_message', $message );
		update_post_meta( $post_id, '_kc_items', wp_json_encode( $clean_items ) );

		kc_send_quote_notification_emails( $name, $company, $email, $phone, $message, $clean_items );
	}

	$redirect = ! empty( $_POST['_wp_http_referer'] ) ? esc_url_raw( wp_unslash( $_POST['_wp_http_referer'] ) ) : home_url( '/request-a-quote/' );
	wp_safe_redirect( add_query_arg( 'kc_quote', 'sent', $redirect ) );
	exit;
}
add_action( 'admin_post_kc_submit_quote_request', 'kc_handle_quote_submission' );
add_action( 'admin_post_nopriv_kc_submit_quote_request', 'kc_handle_quote_submission' );

function kc_send_quote_notification_emails( $name, $company, $email, $phone, $message, $items ) {
	$admin_email = get_theme_mod( 'kc_quote_notify_email', get_option( 'admin_email' ) );

	$items_list = '';
	foreach ( $items as $item ) {
		$items_list .= '- ' . $item['name'] . ( $item['category'] ? ' (' . $item['category'] . ')' : '' ) . "\n";
	}
	if ( empty( $items_list ) ) {
		$items_list = __( '(No specific items attached — see project details below.)', 'kanz-corner' ) . "\n";
	}

	/* translators: 1: customer name */
	$subject = sprintf( __( 'New quote request from %s', 'kanz-corner' ), $name );
	$body    = sprintf(
		"%s\n%s: %s\n%s: %s\n%s: %s\n\n%s:\n%s\n\n%s:\n%s\n",
		__( 'A new quote request was submitted on the website.', 'kanz-corner' ),
		__( 'Name', 'kanz-corner' ), $name,
		__( 'Company', 'kanz-corner' ), $company ?: '—',
		__( 'Phone', 'kanz-corner' ), $phone,
		__( 'Items requested', 'kanz-corner' ), $items_list,
		__( 'Project details', 'kanz-corner' ), $message ?: '—'
	);

	wp_mail( $admin_email, $subject, $body, array( 'Reply-To: ' . $email ) );

	/* translators: %s: store name */
	$customer_subject = sprintf( __( 'We received your quote request — %s', 'kanz-corner' ), get_bloginfo( 'name' ) );
	/* translators: %s: customer name */
	$customer_body = sprintf( __( "Hi %s,\n\nThanks for reaching out to Kanz Corner Trading. Our technical team has received your request and will get back to you within 24 hours with pricing and lead time.\n\nIf it's urgent, call or WhatsApp us at %s.\n\n— Kanz Corner Trading", 'kanz-corner' ), $name, get_theme_mod( 'kc_phone', '+966 50 726 4938' ) );
	wp_mail( $email, $customer_subject, $customer_body );
}

/* ------------------------------------------------------------------------
 * 5. Header/drawer helpers
 * ---------------------------------------------------------------------- */
function kc_get_quote_list_count() {
	// The authoritative list lives in the visitor's localStorage; this only
	// sets the server-rendered starting point (assets/js/main.js corrects it
	// to the real count within the same paint, avoiding an SSR/client mismatch flash).
	return 0;
}

function kc_render_quote_drawer_items() {
	echo '<p style="color:var(--text-muted)">' . esc_html__( 'No items added yet. Browse products and tap "Request Quote" to add them here.', 'kanz-corner' ) . '</p>';
}

/* ------------------------------------------------------------------------
 * 6. General contact form (no item list) for the Contact page.
 * ---------------------------------------------------------------------- */
function kc_contact_form_shortcode() {
	ob_start();
	$success = isset( $_GET['kc_contact'] ) && 'sent' === $_GET['kc_contact'];
	?>
	<?php if ( $success ) : ?>
		<div class="badge badge-stock" style="margin-bottom:24px;padding:14px 20px;font-size:14px">
			<?php esc_html_e( 'Message sent — thank you. We\'ll reply within 1 business day.', 'kanz-corner' ); ?>
		</div>
	<?php endif; ?>
	<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
		<input type="hidden" name="action" value="kc_submit_contact_form">
		<?php wp_nonce_field( 'kc_submit_contact', 'kc_contact_nonce_field' ); ?>
		<div class="form-grid-2">
			<div class="form-row">
				<label for="kc-c-name"><?php esc_html_e( 'Full name', 'kanz-corner' ); ?> *</label>
				<input type="text" id="kc-c-name" name="name" required>
			</div>
			<div class="form-row">
				<label for="kc-c-email"><?php esc_html_e( 'Email', 'kanz-corner' ); ?> *</label>
				<input type="email" id="kc-c-email" name="email" required>
			</div>
		</div>
		<div class="form-row">
			<label for="kc-c-subject"><?php esc_html_e( 'Subject', 'kanz-corner' ); ?></label>
			<input type="text" id="kc-c-subject" name="subject">
		</div>
		<div class="form-row">
			<label for="kc-c-message"><?php esc_html_e( 'Message', 'kanz-corner' ); ?> *</label>
			<textarea id="kc-c-message" name="message" rows="5" required></textarea>
		</div>
		<button type="submit" class="btn btn-primary btn-block"><?php esc_html_e( 'Send Message', 'kanz-corner' ); ?></button>
	</form>
	<?php
	return ob_get_clean();
}
add_shortcode( 'kc_contact_form', 'kc_contact_form_shortcode' );

function kc_handle_contact_submission() {
	if ( ! isset( $_POST['kc_contact_nonce_field'] ) || ! wp_verify_nonce( $_POST['kc_contact_nonce_field'], 'kc_submit_contact' ) ) {
		wp_die( esc_html__( 'Security check failed. Please go back and try again.', 'kanz-corner' ) );
	}
	$name    = sanitize_text_field( wp_unslash( $_POST['name'] ?? '' ) );
	$email   = sanitize_email( wp_unslash( $_POST['email'] ?? '' ) );
	$subject = sanitize_text_field( wp_unslash( $_POST['subject'] ?? '' ) );
	$message = sanitize_textarea_field( wp_unslash( $_POST['message'] ?? '' ) );

	if ( ! empty( $name ) && is_email( $email ) && ! empty( $message ) ) {
		$admin_email = get_theme_mod( 'kc_quote_notify_email', get_option( 'admin_email' ) );
		wp_mail(
			$admin_email,
			sprintf( '[Contact form] %s', $subject ?: __( 'New message', 'kanz-corner' ) ),
			sprintf( "%s: %s\n%s: %s\n\n%s", __( 'Name', 'kanz-corner' ), $name, __( 'Email', 'kanz-corner' ), $email, $message ),
			array( 'Reply-To: ' . $email )
		);
	}

	$redirect = ! empty( $_POST['_wp_http_referer'] ) ? esc_url_raw( wp_unslash( $_POST['_wp_http_referer'] ) ) : home_url( '/contact/' );
	wp_safe_redirect( add_query_arg( 'kc_contact', 'sent', $redirect ) );
	exit;
}
add_action( 'admin_post_kc_submit_contact_form', 'kc_handle_contact_submission' );
add_action( 'admin_post_nopriv_kc_submit_contact_form', 'kc_handle_contact_submission' );
