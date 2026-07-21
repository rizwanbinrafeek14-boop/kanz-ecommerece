<?php
/**
 * Product specification table: a repeatable label/value list (Size Range,
 * Schedule, Grades, Standards, Brands Available, etc.) so each product
 * category can show whatever technical columns the catalogue used —
 * valves need different fields than fasteners or gauges.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function kc_spec_table_meta_box() {
	add_meta_box(
		'kc_spec_table',
		__( 'Specification Table', 'kanz-corner' ),
		'kc_render_spec_table_meta_box',
		'product',
		'normal',
		'high'
	);

	add_meta_box(
		'kc_quote_only',
		__( 'Pricing Mode', 'kanz-corner' ),
		'kc_render_quote_only_meta_box',
		'product',
		'side',
		'default'
	);
}
add_action( 'add_meta_boxes', 'kc_spec_table_meta_box' );

function kc_render_spec_table_meta_box( $post ) {
	wp_nonce_field( 'kc_spec_table_save', 'kc_spec_table_nonce' );
	$rows = get_post_meta( $post->ID, '_kc_spec_table', true );
	if ( ! is_array( $rows ) || empty( $rows ) ) {
		$rows = array(
			array( 'label' => __( 'Size Range', 'kanz-corner' ), 'value' => '' ),
			array( 'label' => __( 'Standard', 'kanz-corner' ), 'value' => '' ),
			array( 'label' => __( 'Brands Available', 'kanz-corner' ), 'value' => '' ),
		);
	}
	?>
	<p class="description"><?php esc_html_e( 'These rows render as the spec table on the product page (Size, Schedule, Grade, Standard, Brands — whatever applies to this product line).', 'kanz-corner' ); ?></p>
	<table class="widefat" id="kc-spec-rows">
		<thead><tr><th style="width:35%"><?php esc_html_e( 'Label', 'kanz-corner' ); ?></th><th><?php esc_html_e( 'Value', 'kanz-corner' ); ?></th><th style="width:40px"></th></tr></thead>
		<tbody>
			<?php foreach ( $rows as $i => $row ) : ?>
			<tr>
				<td><input type="text" name="kc_spec_label[]" value="<?php echo esc_attr( $row['label'] ); ?>" style="width:100%"></td>
				<td><input type="text" name="kc_spec_value[]" value="<?php echo esc_attr( $row['value'] ); ?>" style="width:100%"></td>
				<td><button type="button" class="button kc-spec-remove-row">&times;</button></td>
			</tr>
			<?php endforeach; ?>
		</tbody>
	</table>
	<p><button type="button" class="button" id="kc-spec-add-row"><?php esc_html_e( '+ Add Row', 'kanz-corner' ); ?></button></p>
	<script>
	jQuery(function($){
		$('#kc-spec-add-row').on('click', function(){
			$('#kc-spec-rows tbody').append('<tr><td><input type="text" name="kc_spec_label[]" style="width:100%"></td><td><input type="text" name="kc_spec_value[]" style="width:100%"></td><td><button type="button" class="button kc-spec-remove-row">&times;</button></td></tr>');
		});
		$('#kc-spec-rows').on('click', '.kc-spec-remove-row', function(){
			$(this).closest('tr').remove();
		});
	});
	</script>
	<?php
}

function kc_render_quote_only_meta_box( $post ) {
	$is_quote_only = get_post_meta( $post->ID, '_kc_quote_only', true );
	?>
	<label>
		<input type="checkbox" name="kc_quote_only" value="1" <?php checked( $is_quote_only, '1' ); ?>>
		<?php esc_html_e( 'Hide "Add to Cart" — show "Request Quote" instead', 'kanz-corner' ); ?>
	</label>
	<p class="description"><?php esc_html_e( 'Leave checked for products without a set price. Uncheck once you set a real price and this product should sell instantly.', 'kanz-corner' ); ?></p>
	<?php
}

function kc_save_product_meta( $post_id ) {
	if ( isset( $_POST['kc_spec_table_nonce'] ) && wp_verify_nonce( $_POST['kc_spec_table_nonce'], 'kc_spec_table_save' ) ) {
		$labels = isset( $_POST['kc_spec_label'] ) ? array_map( 'sanitize_text_field', wp_unslash( $_POST['kc_spec_label'] ) ) : array();
		$values = isset( $_POST['kc_spec_value'] ) ? array_map( 'sanitize_text_field', wp_unslash( $_POST['kc_spec_value'] ) ) : array();
		$rows   = array();
		foreach ( $labels as $i => $label ) {
			if ( '' === trim( $label ) && ( ! isset( $values[ $i ] ) || '' === trim( $values[ $i ] ) ) ) {
				continue;
			}
			$rows[] = array( 'label' => $label, 'value' => $values[ $i ] ?? '' );
		}
		update_post_meta( $post_id, '_kc_spec_table', $rows );

		update_post_meta( $post_id, '_kc_quote_only', isset( $_POST['kc_quote_only'] ) ? '1' : '' );
	}
}
add_action( 'save_post_product', 'kc_save_product_meta' );

function kc_get_spec_table( $product_id ) {
	$rows = get_post_meta( $product_id, '_kc_spec_table', true );
	return is_array( $rows ) ? $rows : array();
}

function kc_product_is_quote_only( $product_id ) {
	$flag = get_post_meta( $product_id, '_kc_quote_only', true );
	if ( '' === $flag ) {
		// Default: no price set yet -> quote-only, matches the "hybrid"
		// buy-now / request-a-quote model chosen for this store.
		$product = wc_get_product( $product_id );
		return ! ( $product && '' !== $product->get_price() );
	}
	return '1' === $flag;
}
