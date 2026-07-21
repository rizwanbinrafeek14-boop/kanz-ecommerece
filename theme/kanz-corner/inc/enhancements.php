<?php
/**
 * Storefront enhancements added in theme v1.1:
 *   - Product-loop category label
 *   - Sub-category tiles on category archives
 *   - Live AJAX product search overlay
 *   - Quick-view modal (AJAX)
 *   - Recently-viewed products (client-side, seeded from single product pages)
 *   - Per-product WhatsApp enquiry / share button
 *   - Uncropped product thumbnails so catalogue photos aren't distorted
 *
 * Front-end behaviour for search / quick-view / recently-viewed lives in
 * assets/js/main.js (the kcAjax object is localised in inc/setup.php).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/* ------------------------------------------------------------------------
 * 1. Product thumbnails: contain, don't hard-crop.
 * The card/gallery CSS already box-fits images with object-fit:contain, so
 * we ask WooCommerce for a larger uncropped source to keep them sharp.
 * ---------------------------------------------------------------------- */
add_filter( 'woocommerce_get_image_size_thumbnail', function ( $size ) {
	return array( 'width' => 600, 'height' => 600, 'crop' => 0 );
} );

/* ------------------------------------------------------------------------
 * 2. Category label above each product title in the loop.
 * ---------------------------------------------------------------------- */
function kc_loop_category_label() {
	global $product;
	if ( ! $product ) {
		return;
	}
	$name = kc_get_primary_category_name( $product->get_id() );
	if ( $name ) {
		echo '<span class="kc-cat-label">' . esc_html( $name ) . '</span>';
	}
}
add_action( 'woocommerce_shop_loop_item_title', 'kc_loop_category_label', 5 );

/* ------------------------------------------------------------------------
 * 3. Sub-category tiles on a category archive that has children.
 * ---------------------------------------------------------------------- */
function kc_render_subcategory_tiles() {
	if ( ! is_product_category() ) {
		return;
	}
	$term = get_queried_object();
	if ( ! $term || is_wp_error( $term ) ) {
		return;
	}
	$children = get_terms( array(
		'taxonomy'   => 'product_cat',
		'parent'     => $term->term_id,
		'hide_empty' => true,
	) );
	if ( empty( $children ) || is_wp_error( $children ) ) {
		return;
	}

	echo '<div class="kc-subcat-tiles">';
	foreach ( $children as $child ) {
		$thumb_id  = get_term_meta( $child->term_id, 'thumbnail_id', true );
		$img       = $thumb_id ? wp_get_attachment_image_url( $thumb_id, 'kc-card' ) : '';
		$icon_slug = kc_map_category_to_icon_slug( $child );
		$fallback  = KC_THEME_URI . '/assets/images/categories/' . $icon_slug . '.svg';
		printf(
			'<a href="%1$s" class="kc-subcat-tile"><span class="kc-subcat-thumb"><img src="%2$s" alt="" loading="lazy"></span><span class="kc-subcat-name">%3$s</span><span class="kc-subcat-count">%4$s</span></a>',
			esc_url( get_term_link( $child ) ),
			esc_url( $img ?: $fallback ),
			esc_html( $child->name ),
			esc_html( sprintf( _n( '%d item', '%d items', $child->count, 'kanz-corner' ), $child->count ) )
		);
	}
	echo '</div>';
}
add_action( 'woocommerce_before_shop_loop', 'kc_render_subcategory_tiles', 5 );

/* ------------------------------------------------------------------------
 * 4. Live AJAX search.
 * ---------------------------------------------------------------------- */
function kc_ajax_search() {
	check_ajax_referer( 'kc_search_nonce', 'nonce' );

	$term = isset( $_GET['q'] ) ? sanitize_text_field( wp_unslash( $_GET['q'] ) ) : '';
	if ( strlen( $term ) < 2 ) {
		wp_send_json( array( 'results' => array() ) );
	}

	$query = new WP_Query( array(
		'post_type'      => 'product',
		'posts_per_page' => 8,
		's'              => $term,
		'post_status'    => 'publish',
		'no_found_rows'  => true,
	) );

	$results = array();
	if ( $query->have_posts() ) {
		while ( $query->have_posts() ) {
			$query->the_post();
			$product = wc_get_product( get_the_ID() );
			if ( ! $product ) {
				continue;
			}
			$results[] = array(
				'name'     => $product->get_name(),
				'url'      => get_permalink( $product->get_id() ),
				'image'    => kc_get_product_placeholder_image( $product->get_id() ),
				'category' => kc_get_primary_category_name( $product->get_id() ),
				'price'    => kc_product_is_quote_only( $product->get_id() )
					? esc_html__( 'Price on request', 'kanz-corner' )
					: wp_strip_all_tags( $product->get_price_html() ),
			);
		}
	}
	wp_reset_postdata();

	wp_send_json( array( 'results' => $results, 'shopUrl' => add_query_arg( 's', rawurlencode( $term ), get_permalink( wc_get_page_id( 'shop' ) ) ) ) );
}
add_action( 'wp_ajax_kc_search', 'kc_ajax_search' );
add_action( 'wp_ajax_nopriv_kc_search', 'kc_ajax_search' );

/* ------------------------------------------------------------------------
 * 5. Quick-view modal content (AJAX).
 * ---------------------------------------------------------------------- */
function kc_ajax_quickview() {
	check_ajax_referer( 'kc_quickview_nonce', 'nonce' );

	$product_id = isset( $_GET['id'] ) ? absint( $_GET['id'] ) : 0;
	$product    = $product_id ? wc_get_product( $product_id ) : null;
	if ( ! $product ) {
		wp_send_json_error();
	}

	$is_quote = kc_product_is_quote_only( $product_id );
	$rows     = kc_get_spec_table( $product_id );
	$wa       = preg_replace( '/[^0-9]/', '', get_theme_mod( 'kc_whatsapp', '966507264938' ) );

	ob_start();
	?>
	<div class="kc-qv-grid">
		<div class="kc-qv-image">
			<img src="<?php echo esc_url( kc_get_product_placeholder_image( $product_id ) ); ?>" alt="<?php echo esc_attr( $product->get_name() ); ?>">
		</div>
		<div class="kc-qv-body">
			<span class="kc-cat-label"><?php echo esc_html( kc_get_primary_category_name( $product_id ) ); ?></span>
			<h2><?php echo esc_html( $product->get_name() ); ?></h2>
			<div class="kc-qv-price">
				<?php echo $is_quote ? '<span class="price-on-request">' . esc_html__( 'Price on request', 'kanz-corner' ) . '</span>' : wp_kses_post( $product->get_price_html() ); ?>
			</div>
			<?php if ( $product->get_short_description() ) : ?>
				<div class="kc-qv-desc"><?php echo wp_kses_post( $product->get_short_description() ); ?></div>
			<?php endif; ?>
			<?php if ( ! empty( $rows ) ) : ?>
				<table class="spec-table">
					<?php foreach ( array_slice( $rows, 0, 5 ) as $row ) : ?>
						<tr><th><?php echo esc_html( $row['label'] ); ?></th><td><?php echo esc_html( $row['value'] ); ?></td></tr>
					<?php endforeach; ?>
				</table>
			<?php endif; ?>
			<div class="kc-qv-actions">
				<?php if ( $is_quote ) : ?>
					<button class="btn btn-primary" data-add-to-quote
						data-id="<?php echo esc_attr( $product_id ); ?>"
						data-name="<?php echo esc_attr( $product->get_name() ); ?>"
						data-category="<?php echo esc_attr( kc_get_primary_category_name( $product_id ) ); ?>"
						data-image="<?php echo esc_url( kc_get_product_placeholder_image( $product_id ) ); ?>"
						data-added-label="<?php esc_attr_e( 'Added ✓', 'kanz-corner' ); ?>"
						data-default-label="<?php esc_attr_e( 'Request Quote', 'kanz-corner' ); ?>">
						<?php esc_html_e( 'Request Quote', 'kanz-corner' ); ?>
					</button>
				<?php else : ?>
					<a href="<?php echo esc_url( $product->add_to_cart_url() ); ?>" class="btn btn-primary" data-quantity="1"><?php esc_html_e( 'Add to Cart', 'kanz-corner' ); ?></a>
				<?php endif; ?>
				<a href="https://wa.me/<?php echo esc_attr( $wa ); ?>?text=<?php echo rawurlencode( sprintf( __( "Hi, I'd like details on: %s", 'kanz-corner' ), $product->get_name() . ' - ' . get_permalink( $product_id ) ) ); ?>" target="_blank" rel="noopener" class="btn btn-outline">
					<?php esc_html_e( 'WhatsApp', 'kanz-corner' ); ?>
				</a>
				<a href="<?php echo esc_url( get_permalink( $product_id ) ); ?>" class="btn btn-ghost"><?php esc_html_e( 'Full details →', 'kanz-corner' ); ?></a>
			</div>
		</div>
	</div>
	<?php
	wp_send_json_success( array( 'html' => ob_get_clean() ) );
}
add_action( 'wp_ajax_kc_quickview', 'kc_ajax_quickview' );
add_action( 'wp_ajax_nopriv_kc_quickview', 'kc_ajax_quickview' );

/* Quick-view button on each product card (top-right of the thumbnail). */
function kc_loop_quickview_button() {
	global $product;
	if ( ! $product ) {
		return;
	}
	printf(
		'<button type="button" class="kc-qv-btn" data-quickview="%1$d" aria-label="%2$s" title="%2$s"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>',
		absint( $product->get_id() ),
		esc_attr__( 'Quick view', 'kanz-corner' )
	);
}
add_action( 'woocommerce_before_shop_loop_item_title', 'kc_loop_quickview_button', 15 );

/* ------------------------------------------------------------------------
 * 6. Recently-viewed: expose current product data on single pages so the
 * client can store it, and render a mount point the JS fills in.
 * ---------------------------------------------------------------------- */
function kc_single_recently_viewed_seed() {
	global $product;
	if ( ! $product ) {
		return;
	}
	$data = array(
		'id'       => $product->get_id(),
		'name'     => $product->get_name(),
		'url'      => get_permalink( $product->get_id() ),
		'image'    => kc_get_product_placeholder_image( $product->get_id() ),
		'category' => kc_get_primary_category_name( $product->get_id() ),
		'price'    => kc_product_is_quote_only( $product->get_id() )
			? esc_html__( 'Price on request', 'kanz-corner' )
			: wp_strip_all_tags( $product->get_price_html() ),
	);
	echo '<script type="application/json" id="kc-current-product">' . wp_json_encode( $data ) . '</script>';
}
add_action( 'woocommerce_after_single_product', 'kc_single_recently_viewed_seed' );

/* Recently-viewed strip mount point (rendered on shop + single pages). */
function kc_recently_viewed_mount() {
	echo '<section class="section kc-recently-viewed" hidden><div class="container"><div class="section-head"><div><span class="eyebrow">' . esc_html__( 'Recently viewed', 'kanz-corner' ) . '</span><h2 class="section-title">' . esc_html__( 'Pick up where you left off', 'kanz-corner' ) . '</h2></div></div><div class="product-grid js-recently-viewed"></div></div></section>';
}
add_action( 'woocommerce_after_main_content', 'kc_recently_viewed_mount', 20 );

/* ------------------------------------------------------------------------
 * 7. Per-product WhatsApp enquiry button on the single product summary
 * (shown for priced products too; quote-only products already show one via
 * inc/woocommerce.php's kc_render_single_quote_button).
 * ---------------------------------------------------------------------- */
function kc_single_whatsapp_button() {
	global $product;
	if ( ! $product || kc_product_is_quote_only( $product->get_id() ) ) {
		return; // quote-only products already render a WhatsApp button
	}
	$wa = preg_replace( '/[^0-9]/', '', get_theme_mod( 'kc_whatsapp', '966507264938' ) );
	if ( ! $wa ) {
		return;
	}
	printf(
		'<a href="https://wa.me/%1$s?text=%2$s" target="_blank" rel="noopener" class="btn btn-outline kc-single-wa"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.9-1.3A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1 1 12 20z"/></svg> %3$s</a>',
		esc_attr( $wa ),
		rawurlencode( sprintf( __( "Hi, I'd like details on: %s", 'kanz-corner' ), $product->get_name() . ' - ' . get_permalink( $product->get_id() ) ) ),
		esc_html__( 'Enquire on WhatsApp', 'kanz-corner' )
	);
}
add_action( 'woocommerce_single_product_summary', 'kc_single_whatsapp_button', 35 );

/* ------------------------------------------------------------------------
 * 8b. Working shop filters (category + availability), wired to the query.
 * Rendered by archive-product.php via kc_render_shop_filters().
 * ---------------------------------------------------------------------- */
function kc_render_shop_filters() {
	if ( ! function_exists( 'is_shop' ) || ! ( is_shop() || is_product_category() ) ) {
		return;
	}

	$current_cat  = is_product_category() ? get_queried_object() : null;
	$current_avail = isset( $_GET['kc_avail'] ) ? sanitize_key( $_GET['kc_avail'] ) : '';

	// Category list: children of current category, or all top-level categories on the main shop.
	$parent = $current_cat ? $current_cat->term_id : 0;
	$cats   = get_terms( array(
		'taxonomy'   => 'product_cat',
		'parent'     => $parent,
		'hide_empty' => true,
	) );

	echo '<aside class="filter-panel">';

	if ( ! empty( $cats ) && ! is_wp_error( $cats ) ) {
		echo '<div class="widget"><h4 class="widget-title">' . esc_html__( 'Categories', 'kanz-corner' ) . '</h4><ul>';
		foreach ( $cats as $c ) {
			printf(
				'<li><a href="%s">%s <span style="color:var(--text-muted)">(%d)</span></a></li>',
				esc_url( get_term_link( $c ) ),
				esc_html( $c->name ),
				(int) $c->count
			);
		}
		echo '</ul></div>';
	}

	// Availability filter (preserves the current page URL, toggles kc_avail).
	$base = is_product_category() ? get_term_link( $current_cat ) : get_permalink( wc_get_page_id( 'shop' ) );
	$opts = array(
		''      => __( 'All products', 'kanz-corner' ),
		'stock' => __( 'In stock (buy now)', 'kanz-corner' ),
		'quote' => __( 'Request a quote', 'kanz-corner' ),
	);
	echo '<div class="widget"><h4 class="widget-title">' . esc_html__( 'Availability', 'kanz-corner' ) . '</h4><ul>';
	foreach ( $opts as $val => $label ) {
		$url    = $val ? add_query_arg( 'kc_avail', $val, $base ) : remove_query_arg( 'kc_avail', $base );
		$active = ( $current_avail === $val ) ? ' style="color:var(--kc-red);font-weight:700"' : '';
		printf( '<li><a href="%s"%s>%s</a></li>', esc_url( $url ), $active, esc_html( $label ) );
	}
	echo '</ul></div>';

	if ( $current_avail || is_product_category() ) {
		echo '<div class="widget"><a href="' . esc_url( get_permalink( wc_get_page_id( 'shop' ) ) ) . '" style="font-weight:700;color:var(--kc-red)">' . esc_html__( '× Clear filters', 'kanz-corner' ) . '</a></div>';
	}

	// Guidance for the admin on richer attribute-based filtering.
	echo '<div class="widget" style="font-size:var(--fs-xs);color:var(--text-muted)">' . esc_html__( 'Tip: to filter by size/schedule/material, create those as product attributes and add WooCommerce\'s "Filter by Attribute" widget here — see the admin guide.', 'kanz-corner' ) . '</div>';

	echo '</aside>';
}

/* Apply the availability filter to the shop query. */
function kc_filter_shop_query( $query ) {
	if ( is_admin() || ! $query->is_main_query() ) {
		return;
	}
	if ( ! ( $query->is_post_type_archive( 'product' ) || $query->is_tax( 'product_cat' ) ) ) {
		return;
	}
	$avail = isset( $_GET['kc_avail'] ) ? sanitize_key( $_GET['kc_avail'] ) : '';
	if ( ! $avail ) {
		return;
	}

	$meta_query = (array) $query->get( 'meta_query' );
	if ( 'stock' === $avail ) {
		// Priced, buyable items: a real numeric price AND not flagged quote-only.
		$meta_query[] = array(
			'relation' => 'AND',
			array( 'key' => '_price', 'value' => 0, 'compare' => '>', 'type' => 'NUMERIC' ),
			array(
				'relation' => 'OR',
				array( 'key' => '_kc_quote_only', 'compare' => 'NOT EXISTS' ),
				array( 'key' => '_kc_quote_only', 'value' => '1', 'compare' => '!=' ),
			),
		);
	} elseif ( 'quote' === $avail ) {
		$meta_query[] = array(
			'relation' => 'OR',
			array( 'key' => '_kc_quote_only', 'value' => '1', 'compare' => '=' ),
			array( 'key' => '_price', 'value' => '', 'compare' => '=' ),
			array( 'key' => '_price', 'compare' => 'NOT EXISTS' ),
		);
	}
	$query->set( 'meta_query', $meta_query );
}
add_action( 'pre_get_posts', 'kc_filter_shop_query' );

/* ------------------------------------------------------------------------
 * 9. Search overlay + quick-view modal markup (printed once in the footer).
 * ---------------------------------------------------------------------- */
function kc_render_overlays() {
	if ( ! class_exists( 'WooCommerce' ) ) {
		return;
	}
	?>
	<div class="kc-search-overlay" id="kc-search-overlay" aria-hidden="true">
		<div class="kc-search-panel">
			<div class="kc-search-inputwrap">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
				<input type="search" id="kc-search-input" placeholder="<?php esc_attr_e( 'Search pipes, fittings, valves…', 'kanz-corner' ); ?>" autocomplete="off">
				<button type="button" data-close-search aria-label="<?php esc_attr_e( 'Close', 'kanz-corner' ); ?>">&times;</button>
			</div>
			<div class="kc-search-results" id="kc-search-results"></div>
		</div>
		<div class="kc-search-backdrop" data-close-search></div>
	</div>

	<div class="kc-modal" id="kc-quickview-modal" aria-hidden="true">
		<div class="kc-modal-backdrop" data-close-modal></div>
		<div class="kc-modal-dialog" role="dialog" aria-modal="true">
			<button type="button" class="kc-modal-close" data-close-modal aria-label="<?php esc_attr_e( 'Close', 'kanz-corner' ); ?>">&times;</button>
			<div class="kc-modal-content" id="kc-quickview-content"></div>
		</div>
	</div>
	<?php
}
add_action( 'wp_footer', 'kc_render_overlays' );
