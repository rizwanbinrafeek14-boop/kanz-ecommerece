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
add_action( 'woocommerce_shop_loop_item_title', kc_guard( 'kc_loop_category_label' ), 5 );

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
add_action( 'woocommerce_before_shop_loop', kc_guard( 'kc_render_subcategory_tiles' ), 5 );

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
add_action( 'woocommerce_before_shop_loop_item_title', kc_guard( 'kc_loop_quickview_button' ), 15 );

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
add_action( 'woocommerce_after_single_product', kc_guard( 'kc_single_recently_viewed_seed' ) );

/* Recently-viewed strip mount point (rendered on shop + single pages). */
function kc_recently_viewed_mount() {
	echo '<section class="section kc-recently-viewed" hidden><div class="container"><div class="section-head"><div><span class="eyebrow">' . esc_html__( 'Recently viewed', 'kanz-corner' ) . '</span><h2 class="section-title">' . esc_html__( 'Pick up where you left off', 'kanz-corner' ) . '</h2></div></div><div class="product-grid js-recently-viewed"></div></div></section>';
}
add_action( 'woocommerce_after_main_content', kc_guard( 'kc_recently_viewed_mount' ), 20 );

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
add_action( 'woocommerce_single_product_summary', kc_guard( 'kc_single_whatsapp_button' ), 35 );

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

/* ========================================================================
 * v1.2 additions
 * ====================================================================== */

/* Shared wishlist-button attribute string for a product. */
function kc_wish_attrs( $product ) {
	return sprintf(
		'data-wish data-id="%d" data-name="%s" data-url="%s" data-image="%s" data-category="%s"',
		absint( $product->get_id() ),
		esc_attr( $product->get_name() ),
		esc_url( get_permalink( $product->get_id() ) ),
		esc_url( kc_get_product_placeholder_image( $product->get_id() ) ),
		esc_attr( kc_get_primary_category_name( $product->get_id() ) )
	);
}

/* 10. Wishlist heart on product cards + bestseller badge. */
function kc_loop_card_extras() {
	global $product;
	if ( ! $product ) {
		return;
	}
	printf(
		'<button type="button" class="kc-wish-btn" %s aria-label="%s"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></button>',
		kc_wish_attrs( $product ), // phpcs:ignore -- pre-escaped
		esc_attr__( 'Save to wishlist', 'kanz-corner' )
	);
	if ( '1' === get_post_meta( $product->get_id(), '_kc_bestseller', true ) ) {
		echo '<span class="kc-bestseller-badge"><svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>' . esc_html__( 'Best Seller', 'kanz-corner' ) . '</span>';
	} elseif ( '1' === get_post_meta( $product->get_id(), '_kc_special_offer', true ) ) {
		$label = get_post_meta( $product->get_id(), '_kc_offer_label', true );
		echo '<span class="kc-deal-badge">' . esc_html( $label ?: __( 'Special Offer', 'kanz-corner' ) ) . '</span>';
	}

	// v1.4: Electric-House-style corner badges.
	$is_quote = function_exists( 'kc_product_is_quote_only' ) ? kc_product_is_quote_only( $product->get_id() ) : false;
	$now      = (float) $product->get_price();
	if ( ! $is_quote && $now > 0 && $product->is_in_stock() ) {
		echo '<span class="kc-stock-badge">' . esc_html__( 'In-stock', 'kanz-corner' ) . '</span>';
	}
	$pct = 0;
	if ( $now > 0 ) {
		if ( $product->is_on_sale() && (float) $product->get_regular_price() > $now ) {
			$pct = round( ( 1 - $now / (float) $product->get_regular_price() ) * 100 );
		} else {
			$meta_old = str_replace( ',', '', (string) get_post_meta( $product->get_id(), '_kc_old_price', true ) );
			if ( is_numeric( $meta_old ) && (float) $meta_old > $now ) {
				$pct = round( ( 1 - $now / (float) $meta_old ) * 100 );
			}
		}
	}
	if ( $pct >= 3 ) {
		echo '<span class="kc-pct-badge">-' . absint( $pct ) . '%</span>';
	}
}
add_action( 'woocommerce_before_shop_loop_item_title', kc_guard( 'kc_loop_card_extras' ), 12 );

/* 11. Single product: wishlist + share row. */
function kc_single_wish_share_row() {
	global $product;
	if ( ! $product ) {
		return;
	}
	$url   = get_permalink( $product->get_id() );
	$title = $product->get_name();
	?>
	<div class="kc-share-row">
		<button type="button" class="kc-wish-single" <?php echo kc_wish_attrs( $product ); // phpcs:ignore ?>>
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
			<?php esc_html_e( 'Save', 'kanz-corner' ); ?>
		</button>
		<span><?php esc_html_e( 'Share:', 'kanz-corner' ); ?></span>
		<button type="button" class="kc-share-btn" data-share="whatsapp" data-url="<?php echo esc_url( $url ); ?>" data-title="<?php echo esc_attr( $title ); ?>" aria-label="WhatsApp">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.9-1.3A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1 1 12 20z"/></svg>
		</button>
		<button type="button" class="kc-share-btn" data-share="x" data-url="<?php echo esc_url( $url ); ?>" data-title="<?php echo esc_attr( $title ); ?>" aria-label="X">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h3l-7.5 8.6L22 22h-6.6l-5.2-6.8L4.2 22H1.2l8-9.2L2 2h6.8l4.7 6.2z"/></svg>
		</button>
		<button type="button" class="kc-share-btn" data-share="copy" data-url="<?php echo esc_url( $url ); ?>" aria-label="<?php esc_attr_e( 'Copy link', 'kanz-corner' ); ?>">
			<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
		</button>
	</div>
	<?php
}
add_action( 'woocommerce_single_product_summary', kc_guard( 'kc_single_wish_share_row' ), 45 );

/* 12. Sticky mobile buy/quote bar on single product pages. */
function kc_single_sticky_bar() {
	global $product;
	if ( ! is_product() || ! $product ) {
		return;
	}
	$is_quote = kc_product_is_quote_only( $product->get_id() );
	$wa       = preg_replace( '/[^0-9]/', '', get_theme_mod( 'kc_whatsapp', '966507264938' ) );
	?>
	<div class="kc-sticky-bar">
		<div class="kc-sticky-price">
			<?php if ( $is_quote ) : ?>
				<b style="color:var(--kc-red);font-size:13px"><?php esc_html_e( 'Price on request', 'kanz-corner' ); ?></b>
			<?php else : ?>
				<b><?php echo wp_kses_post( wc_price( (float) $product->get_price() ) ); ?></b>
				<span><?php esc_html_e( 'incl. VAT', 'kanz-corner' ); ?></span>
			<?php endif; ?>
		</div>
		<?php if ( $is_quote ) : ?>
			<button class="btn btn-primary" data-add-to-quote
				data-id="<?php echo esc_attr( $product->get_id() ); ?>"
				data-name="<?php echo esc_attr( $product->get_name() ); ?>"
				data-category="<?php echo esc_attr( kc_get_primary_category_name( $product->get_id() ) ); ?>"
				data-image="<?php echo esc_url( kc_get_product_placeholder_image( $product->get_id() ) ); ?>"
				data-added-label="<?php esc_attr_e( 'Added ✓', 'kanz-corner' ); ?>"
				data-default-label="<?php esc_attr_e( 'Request Quote', 'kanz-corner' ); ?>"><?php esc_html_e( 'Request Quote', 'kanz-corner' ); ?></button>
			<a class="btn btn-dark" target="_blank" rel="noopener" href="https://wa.me/<?php echo esc_attr( $wa ); ?>?text=<?php echo rawurlencode( sprintf( __( "Hi, I'd like a quote for: %s", 'kanz-corner' ), $product->get_name() . ' - ' . get_permalink( $product->get_id() ) ) ); ?>"><?php esc_html_e( 'WhatsApp', 'kanz-corner' ); ?></a>
		<?php else : ?>
			<a class="btn btn-primary" href="<?php echo esc_url( $product->add_to_cart_url() ); ?>"><?php esc_html_e( 'Add to Cart', 'kanz-corner' ); ?></a>
			<a class="btn btn-dark" href="<?php echo esc_url( add_query_arg( 'add-to-cart', $product->get_id(), wc_get_checkout_url() ) ); ?>"><?php esc_html_e( 'Buy Now', 'kanz-corner' ); ?></a>
		<?php endif; ?>
	</div>
	<?php
}
add_action( 'wp_footer', kc_guard( 'kc_single_sticky_bar' ), 5 );

/* 13. Search overlay + quick-view modal markup (printed once in the footer). */
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
add_action( 'wp_footer', kc_guard( 'kc_render_overlays' ) );

/* ------------------------------------------------------------------------
 * v1.3 — Special Offers.
 * ---------------------------------------------------------------------- */

/* Struck-through old price next to the current price / "Price on request". */
function kc_offer_old_price_html( $price_html, $product ) {
	// Priced products get their old price inside the dual-VAT lines
	// (inc/woocommerce.php); this only decorates quote-only offers.
	if ( ! kc_product_is_quote_only( $product->get_id() ) ) {
		return $price_html;
	}
	$old = get_post_meta( $product->get_id(), '_kc_old_price', true );
	if ( '' === $old || '1' !== get_post_meta( $product->get_id(), '_kc_special_offer', true ) ) {
		return $price_html;
	}
	$old_fmt = is_numeric( str_replace( ',', '', $old ) ) ? wc_price( (float) str_replace( ',', '', $old ) ) : esc_html( $old );
	return '<del class="kc-old-price" aria-hidden="true">' . $old_fmt . '</del> ' . $price_html;
}
add_filter( 'woocommerce_get_price_html', kc_guard_filter( 'kc_offer_old_price_html' ), 60, 2 );

/* Homepage "Special Offers" row: products the admin ticked in the
 * Pricing Mode box (Products -> edit product -> Special Offers). Renders
 * nothing when no product is marked, so the homepage stays clean. */
function kc_render_special_offers() {
	try {
		if ( ! class_exists( 'WooCommerce' ) ) {
			return;
		}
		$offers = new WP_Query( array(
			'post_type'      => 'product',
			'posts_per_page' => 8,
			'meta_query'     => array( array( 'key' => '_kc_special_offer', 'value' => '1' ) ), // phpcs:ignore
		) );
		if ( ! $offers->have_posts() ) {
			return;
		}
		?>
		<section class="section kc-offers kc-hscroll">
			<div class="container">
				<div class="section-head">
					<div>
						<span class="eyebrow"><?php esc_html_e( 'Limited-time deals', 'kanz-corner' ); ?></span>
						<h2 class="section-title"><?php esc_html_e( 'Special Offers', 'kanz-corner' ); ?></h2>
					</div>
					<a href="<?php echo esc_url( wc_get_page_permalink( 'shop' ) ); ?>" class="btn btn-outline"><?php esc_html_e( 'View All', 'kanz-corner' ); ?></a>
				</div>
				<ul class="products columns-4">
					<?php
					while ( $offers->have_posts() ) :
						$offers->the_post();
						wc_get_template_part( 'content', 'product' );
					endwhile;
					wp_reset_postdata();
					?>
				</ul>
			</div>
		</section>
		<?php
	} catch ( \Throwable $e ) {
		error_log( 'Kanz Corner theme suppressed error in kc_render_special_offers: ' . $e->getMessage() );
	}
}

/* ------------------------------------------------------------------------
 * v1.4 — Electric-House-style storefront.
 * ---------------------------------------------------------------------- */

/* Second loop button: priced products get "Add to Quote" beside Add to Cart. */
function kc_loop_quote_button() {
	global $product;
	if ( ! $product || kc_product_is_quote_only( $product->get_id() ) ) {
		return;
	}
	printf(
		'<a href="%1$s" class="btn btn-outline btn-sm kc-loop-quote" data-add-to-quote data-id="%2$s" data-name="%3$s" data-category="%4$s" data-image="%5$s">%6$s</a>',
		esc_url( home_url( '/request-a-quote/' ) ),
		esc_attr( $product->get_id() ),
		esc_attr( $product->get_name() ),
		esc_attr( kc_get_primary_category_name( $product->get_id() ) ),
		esc_url( kc_get_product_placeholder_image( $product->get_id() ) ),
		esc_html__( 'Add to Quote', 'kanz-corner' )
	);
}
add_action( 'woocommerce_after_shop_loop_item', kc_guard( 'kc_loop_quote_button' ), 15 );

/* Resolve the best available image for a category tile. */
function kc_get_category_tile_image( $cat ) {
	$thumb_id = get_term_meta( $cat->term_id, 'thumbnail_id', true );
	if ( $thumb_id ) {
		$img = wp_get_attachment_image_url( $thumb_id, 'kc-card' );
		if ( $img ) {
			return $img;
		}
	}
	if ( file_exists( KC_THEME_DIR . '/assets/images/cat-photos/' . $cat->slug . '.jpg' ) ) {
		return KC_THEME_URI . '/assets/images/cat-photos/' . $cat->slug . '.jpg';
	}
	return KC_THEME_URI . '/assets/images/categories/' . kc_map_category_to_icon_slug( $cat ) . '.svg';
}

/* Mega "Shop by Category" panel: category list left, sub-category tiles right. */
function kc_render_mega_menu() {
	try {
		if ( ! taxonomy_exists( 'product_cat' ) ) {
			return;
		}
		$tops = get_terms( array( 'taxonomy' => 'product_cat', 'hide_empty' => false, 'parent' => 0, 'exclude' => array( get_option( 'default_product_cat' ) ) ) );
		if ( is_wp_error( $tops ) || empty( $tops ) ) {
			return;
		}
		echo '<div class="kc-mega" id="kc-mega" aria-hidden="true"><div class="container"><div class="kc-mega-inner">';
		echo '<ul class="kc-mega-list">';
		foreach ( $tops as $i => $cat ) {
			printf(
				'<li class="kc-mega-item%1$s" data-pane="kc-pane-%2$d"><a href="%3$s"><img src="%4$s" alt="" loading="lazy">%5$s<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg></a></li>',
				0 === $i ? ' is-active' : '',
				(int) $cat->term_id,
				esc_url( get_term_link( $cat ) ),
				esc_url( KC_THEME_URI . '/assets/images/categories/' . kc_map_category_to_icon_slug( $cat ) . '.svg' ),
				esc_html( $cat->name )
			);
		}
		echo '</ul><div class="kc-mega-panes">';
		foreach ( $tops as $i => $cat ) {
			$children = get_terms( array( 'taxonomy' => 'product_cat', 'parent' => $cat->term_id, 'hide_empty' => false, 'number' => 12 ) );
			printf( '<div class="kc-mega-pane%1$s" id="kc-pane-%2$d"><h4><a href="%3$s">%4$s</a></h4><div class="kc-mega-tiles">', 0 === $i ? ' is-active' : '', (int) $cat->term_id, esc_url( get_term_link( $cat ) ), esc_html( $cat->name ) );
			if ( ! is_wp_error( $children ) && ! empty( $children ) ) {
				foreach ( $children as $child ) {
					printf(
						'<a href="%1$s" class="kc-mega-tile"><span class="ph"><img src="%2$s" alt="" loading="lazy"></span><span class="nm">%3$s</span></a>',
						esc_url( get_term_link( $child ) ),
						esc_url( kc_get_category_tile_image( $child ) ),
						esc_html( $child->name )
					);
				}
			} else {
				printf(
					'<a href="%1$s" class="kc-mega-tile"><span class="ph"><img src="%2$s" alt="" loading="lazy"></span><span class="nm">%3$s</span></a>',
					esc_url( get_term_link( $cat ) ),
					esc_url( kc_get_category_tile_image( $cat ) ),
					esc_html( sprintf( __( 'Browse all %s', 'kanz-corner' ), $cat->name ) )
				);
			}
			echo '</div></div>';
		}
		echo '</div></div></div></div>';
	} catch ( \Throwable $e ) {
		error_log( 'Kanz Corner theme suppressed error in kc_render_mega_menu: ' . $e->getMessage() );
	}
}

/* Homepage per-category showcases: hero band + sub-category chips + products. */
function kc_render_category_showcases() {
	try {
		if ( ! class_exists( 'WooCommerce' ) ) {
			return;
		}
		$tops = get_terms( array( 'taxonomy' => 'product_cat', 'hide_empty' => true, 'parent' => 0, 'exclude' => array( get_option( 'default_product_cat' ) ) ) );
		if ( is_wp_error( $tops ) || empty( $tops ) ) {
			return;
		}
		$shown = 0;
		foreach ( $tops as $cat ) {
			if ( $shown >= 4 ) {
				break;
			}
			$q = new WP_Query( array(
				'post_type'      => 'product',
				'posts_per_page' => 8,
				'no_found_rows'  => true,
				'tax_query'      => array( array( 'taxonomy' => 'product_cat', 'field' => 'term_id', 'terms' => $cat->term_id ) ), // phpcs:ignore
			) );
			if ( ! $q->have_posts() ) {
				continue;
			}
			$shown++;
			$photo    = kc_get_category_tile_image( $cat );
			$children = get_terms( array( 'taxonomy' => 'product_cat', 'parent' => $cat->term_id, 'hide_empty' => true, 'number' => 6 ) );
			?>
			<section class="section-tight kc-catshow kc-hscroll">
				<div class="container">
					<div class="kc-catband" style="background-image:linear-gradient(100deg, rgba(16,18,28,.96) 30%, rgba(16,18,28,.55) 65%, rgba(16,18,28,.15)), url('<?php echo esc_url( $photo ); ?>');">
						<div>
							<span class="eyebrow"><?php echo esc_html( sprintf( _n( '%d product', '%d products', $cat->count, 'kanz-corner' ), $cat->count ) ); ?></span>
							<h2><?php echo esc_html( $cat->name ); ?></h2>
						</div>
						<a href="<?php echo esc_url( get_term_link( $cat ) ); ?>" class="btn btn-outline-light btn-sm"><?php esc_html_e( 'View All', 'kanz-corner' ); ?></a>
					</div>
					<?php if ( ! is_wp_error( $children ) && ! empty( $children ) ) : ?>
						<div class="kc-catchips">
							<?php foreach ( $children as $child ) : ?>
								<a href="<?php echo esc_url( get_term_link( $child ) ); ?>"><?php echo esc_html( $child->name ); ?></a>
							<?php endforeach; ?>
						</div>
					<?php endif; ?>
					<ul class="products columns-4">
						<?php
						while ( $q->have_posts() ) :
							$q->the_post();
							wc_get_template_part( 'content', 'product' );
						endwhile;
						wp_reset_postdata();
						?>
					</ul>
				</div>
			</section>
			<?php
		}
	} catch ( \Throwable $e ) {
		error_log( 'Kanz Corner theme suppressed error in kc_render_category_showcases: ' . $e->getMessage() );
	}
}
