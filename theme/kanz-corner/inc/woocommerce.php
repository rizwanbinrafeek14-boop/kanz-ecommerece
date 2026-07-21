<?php
/**
 * WooCommerce integration: theme wrappers, the "Buy Now vs Request Quote"
 * hybrid behaviour, and a custom Freight Quote shipping method for bulky
 * industrial orders (pipes/valves) alongside built-in Local Pickup.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/* ------------------------------------------------------------------------
 * Theme wrapper hooks WooCommerce templates render into.
 * ---------------------------------------------------------------------- */
remove_action( 'woocommerce_before_main_content', 'woocommerce_output_content_wrapper', 10 );
remove_action( 'woocommerce_after_main_content', 'woocommerce_output_content_wrapper_end', 10 );

function kc_wc_wrapper_start() {
	echo '<div class="container" style="padding-block:32px 64px">';
}
add_action( 'woocommerce_before_main_content', 'kc_wc_wrapper_start', 10 );

function kc_wc_wrapper_end() {
	echo '</div>';
}
add_action( 'woocommerce_after_main_content', 'kc_wc_wrapper_end', 10 );

// The theme ships its own header/footer chrome via header.php/footer.php.
remove_action( 'woocommerce_before_shop_loop', 'woocommerce_result_count', 20 );
remove_action( 'woocommerce_before_shop_loop', 'woocommerce_catalog_ordering', 30 );

/* ------------------------------------------------------------------------
 * VAT-inclusive pricing note: the actual "prices include tax" behaviour is
 * a WooCommerce > Settings > Tax setting (see docs/DEPLOYMENT-GUIDE.md —
 * this is configuration, not code, so it isn't hardcoded here). This just
 * adds the small "incl. VAT" note under the price.
 * ---------------------------------------------------------------------- */
function kc_price_vat_suffix( $price, $product ) {
	if ( ! wc_prices_include_tax() || ! $product->is_taxable() ) {
		return $price;
	}
	return $price . ' <small class="kc-vat-note">' . esc_html__( 'incl. VAT', 'kanz-corner' ) . '</small>';
}
add_filter( 'woocommerce_get_price_html', 'kc_price_vat_suffix', 20, 2 );

/* ------------------------------------------------------------------------
 * Buy Now vs Request Quote
 * A product is "quote only" (see inc/spec-fields.php: kc_product_is_quote_only)
 * when the admin has no price set for it, or explicitly ticks the box. In
 * that state we swap the price display and the add-to-cart button for a
 * "Request Quote" action, everywhere WooCommerce shows them.
 * ---------------------------------------------------------------------- */
function kc_maybe_quote_price_html( $price_html, $product ) {
	if ( kc_product_is_quote_only( $product->get_id() ) ) {
		return '<span class="price-on-request">' . esc_html__( 'Price on request', 'kanz-corner' ) . '</span>';
	}
	return $price_html;
}
add_filter( 'woocommerce_get_price_html', 'kc_maybe_quote_price_html', 5, 2 );

function kc_maybe_quote_loop_button( $button, $product ) {
	if ( kc_product_is_quote_only( $product->get_id() ) ) {
		return sprintf(
			'<a href="%1$s" class="btn btn-primary btn-sm cta" data-add-to-quote data-id="%2$s" data-name="%3$s" data-category="%4$s" data-image="%5$s">%6$s</a>',
			esc_url( get_permalink( $product->get_id() ) ),
			esc_attr( $product->get_id() ),
			esc_attr( $product->get_name() ),
			esc_attr( kc_get_primary_category_name( $product->get_id() ) ),
			esc_url( kc_get_product_placeholder_image( $product->get_id() ) ),
			esc_html__( 'View', 'kanz-corner' )
		);
	}
	return $button;
}
add_filter( 'woocommerce_loop_add_to_cart_link', 'kc_maybe_quote_loop_button', 10, 2 );

function kc_get_primary_category_name( $product_id ) {
	$terms = get_the_terms( $product_id, 'product_cat' );
	if ( is_array( $terms ) && ! empty( $terms ) ) {
		return $terms[0]->name;
	}
	return '';
}

function kc_get_product_placeholder_image( $product_id ) {
	if ( has_post_thumbnail( $product_id ) ) {
		return get_the_post_thumbnail_url( $product_id, 'kc-card' );
	}
	$cat_slug = '';
	$terms    = get_the_terms( $product_id, 'product_cat' );
	if ( is_array( $terms ) && ! empty( $terms ) ) {
		$cat_slug = kc_map_category_to_icon_slug( $terms[0] );
	}
	return KC_THEME_URI . '/assets/images/categories/' . ( $cat_slug ?: 'other' ) . '.svg';
}

/**
 * Maps a WooCommerce product_cat term to one of the 8 illustrated category
 * icons shipped in assets/images/categories/. Walks up to the top-level
 * ancestor first, since most real products sit in a sub-category (e.g.
 * "Pipes > Carbon Steel") rather than directly in a top-level one.
 */
function kc_map_category_to_icon_slug( $term ) {
	if ( is_string( $term ) ) {
		$term = get_term_by( 'slug', $term, 'product_cat' );
	}
	if ( ! $term || is_wp_error( $term ) ) {
		return 'other';
	}

	$top = $term;
	$ancestors = get_ancestors( $term->term_id, 'product_cat' );
	if ( ! empty( $ancestors ) ) {
		$top_id = end( $ancestors ); // furthest ancestor = top-level category
		$maybe  = get_term( $top_id, 'product_cat' );
		if ( $maybe && ! is_wp_error( $maybe ) ) {
			$top = $maybe;
		}
	}

	$map = array(
		'pipes'           => 'pipes',
		'pipe-fittings'   => 'fittings',
		'fittings'        => 'fittings',
		'flanges'         => 'flanges',
		'valves'          => 'valves',
		'fasteners'       => 'fasteners',
		'gaskets'         => 'gaskets',
		'gauges'          => 'gauges',
		'gauges-instruments' => 'gauges',
		'other-products'  => 'other',
	);
	return $map[ $top->slug ] ?? 'other';
}

/* ------------------------------------------------------------------------
 * Single-product "Request Quote" replacing Add to Cart form.
 * ---------------------------------------------------------------------- */
function kc_maybe_replace_single_add_to_cart() {
	global $product;
	if ( ! $product || ! kc_product_is_quote_only( $product->get_id() ) ) {
		return;
	}
	remove_action( 'woocommerce_single_product_summary', 'woocommerce_template_single_add_to_cart', 30 );
	add_action( 'woocommerce_single_product_summary', 'kc_render_single_quote_button', 30 );
}
add_action( 'woocommerce_single_product_summary', 'kc_maybe_replace_single_add_to_cart', 1 );

function kc_render_single_quote_button() {
	global $product;
	?>
	<div class="product-actions">
		<button class="btn btn-primary" data-add-to-quote
			data-id="<?php echo esc_attr( $product->get_id() ); ?>"
			data-name="<?php echo esc_attr( $product->get_name() ); ?>"
			data-category="<?php echo esc_attr( kc_get_primary_category_name( $product->get_id() ) ); ?>"
			data-image="<?php echo esc_url( kc_get_product_placeholder_image( $product->get_id() ) ); ?>"
			data-added-label="<?php esc_attr_e( 'Added ✓', 'kanz-corner' ); ?>"
			data-default-label="<?php esc_attr_e( 'Request Quote', 'kanz-corner' ); ?>">
			<?php esc_html_e( 'Request Quote', 'kanz-corner' ); ?>
		</button>
		<?php $wa = preg_replace( '/[^0-9]/', '', get_theme_mod( 'kc_whatsapp', '966507264938' ) ); ?>
		<a href="https://wa.me/<?php echo esc_attr( $wa ); ?>?text=<?php echo rawurlencode( sprintf( __( "Hi, I'd like a quote for: %s", 'kanz-corner' ), $product->get_name() ) ); ?>" target="_blank" rel="noopener" class="btn btn-outline">
			<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.9-1.3A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1 1 12 20z"/></svg>
			<?php esc_html_e( 'Ask on WhatsApp', 'kanz-corner' ); ?>
		</a>
	</div>
	<?php
}

/* ------------------------------------------------------------------------
 * Spec table on the single product page, right after the short description.
 * ---------------------------------------------------------------------- */
function kc_render_single_product_spec_table() {
	global $product;
	if ( ! $product ) {
		return;
	}
	$rows = kc_get_spec_table( $product->get_id() );
	if ( empty( $rows ) ) {
		return;
	}
	echo '<table class="spec-table">';
	foreach ( $rows as $row ) {
		if ( '' === trim( $row['label'] ) && '' === trim( $row['value'] ) ) {
			continue;
		}
		echo '<tr><th>' . esc_html( $row['label'] ) . '</th><td>' . esc_html( $row['value'] ) . '</td></tr>';
	}
	echo '</table>';
}
add_action( 'woocommerce_single_product_summary', 'kc_render_single_product_spec_table', 25 );

/* ------------------------------------------------------------------------
 * Custom "Freight Quote" shipping method — for bulk/heavy pipe & valve
 * orders where a flat rate doesn't make sense. Pairs with WooCommerce's
 * built-in "Local Pickup" method (enable both in the same shipping zone
 * from Settings > Shipping > your zone > Add shipping method).
 * ---------------------------------------------------------------------- */
add_action( 'woocommerce_shipping_init', 'kc_freight_quote_shipping_method_init' );
function kc_freight_quote_shipping_method_init() {
	if ( class_exists( 'KC_Freight_Quote_Shipping_Method' ) ) {
		return;
	}

	class KC_Freight_Quote_Shipping_Method extends WC_Shipping_Method {
		public function __construct( $instance_id = 0 ) {
			$this->id                 = 'kc_freight_quote';
			$this->instance_id        = absint( $instance_id );
			$this->method_title       = __( 'Freight Quote (bulk/heavy items)', 'kanz-corner' );
			$this->method_description = __( 'No cost is charged at checkout. Orders using this method are flagged for the sales team to arrange and price freight separately.', 'kanz-corner' );
			$this->supports            = array( 'shipping-zones', 'instance-settings' );
			$this->init();
		}

		public function init() {
			$this->init_form_fields();
			$this->init_settings();
			$this->title = $this->get_option( 'title', __( 'Request Delivery Quote', 'kanz-corner' ) );
			add_action( 'woocommerce_update_options_shipping_' . $this->id, array( $this, 'process_admin_options' ) );
		}

		public function init_form_fields() {
			$this->instance_form_fields = array(
				'title' => array(
					'title'       => __( 'Method title', 'kanz-corner' ),
					'type'        => 'text',
					'default'     => __( 'Request Delivery Quote', 'kanz-corner' ),
				),
			);
		}

		public function calculate_shipping( $package = array() ) {
			$this->add_rate( array(
				'id'    => $this->get_rate_id(),
				'label' => $this->title,
				'cost'  => 0,
				'meta_data' => array( 'kc_freight_quote' => 'yes' ),
			) );
		}
	}
}

function kc_add_freight_quote_shipping_method( $methods ) {
	$methods['kc_freight_quote'] = 'KC_Freight_Quote_Shipping_Method';
	return $methods;
}
add_filter( 'woocommerce_shipping_methods', 'kc_add_freight_quote_shipping_method' );

/**
 * Flag orders placed with the Freight Quote method so they stand out in
 * Woo Orders and trigger the same admin email your quote requests use.
 */
function kc_flag_freight_quote_order( $order_id ) {
	$order = wc_get_order( $order_id );
	if ( ! $order ) {
		return;
	}
	foreach ( $order->get_shipping_methods() as $shipping ) {
		if ( 'kc_freight_quote' === $shipping->get_method_id() ) {
			$order->update_meta_data( '_kc_needs_freight_quote', 'yes' );
			$order->save();
			break;
		}
	}
}
add_action( 'woocommerce_checkout_order_processed', 'kc_flag_freight_quote_order' );

function kc_freight_quote_order_admin_badge( $order ) {
	if ( 'yes' === $order->get_meta( '_kc_needs_freight_quote' ) ) {
		echo '<mark class="order-status status-on-hold" style="margin-inline-start:6px"><span>' . esc_html__( 'Freight quote needed', 'kanz-corner' ) . '</span></mark>';
	}
}
add_action( 'woocommerce_admin_order_data_after_shipping_address', function ( $order ) {
	kc_freight_quote_order_admin_badge( $order );
} );
