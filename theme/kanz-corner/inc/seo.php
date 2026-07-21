<?php
/**
 * Lightweight SEO: meta description, Open Graph / Twitter cards, and
 * schema.org structured data (Organization site-wide, Product on product
 * pages, BreadcrumbList on inner pages).
 *
 * This is intentionally minimal and defers to a dedicated SEO plugin when
 * one is active: if Yoast or Rank Math is installed, they own <head> meta
 * and this module stays out of the way to avoid duplicate tags.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function kc_seo_plugin_active() {
	return defined( 'WPSEO_VERSION' ) || defined( 'RANK_MATH_VERSION' ) || class_exists( 'WPSEO_Frontend' );
}

/* ------------------------------------------------------------------------
 * Meta description + Open Graph + Twitter tags.
 * ---------------------------------------------------------------------- */
function kc_seo_meta_tags() {
	if ( kc_seo_plugin_active() ) {
		return;
	}

	$title = wp_get_document_title();
	$desc  = '';
	$image = '';
	$type  = 'website';
	$url   = home_url( add_query_arg( array() ) );

	if ( is_singular() ) {
		$post = get_queried_object();
		$url  = get_permalink( $post );

		if ( function_exists( 'is_product' ) && is_product() ) {
			$type    = 'product';
			$product = wc_get_product( $post->ID );
			if ( $product ) {
				$desc  = $product->get_short_description() ? wp_strip_all_tags( $product->get_short_description() ) : wp_strip_all_tags( $product->get_description() );
				$image = function_exists( 'kc_get_product_placeholder_image' ) ? kc_get_product_placeholder_image( $post->ID ) : '';
			}
		} else {
			$desc  = has_excerpt( $post ) ? wp_strip_all_tags( get_the_excerpt( $post ) ) : wp_strip_all_tags( wp_trim_words( $post->post_content, 30 ) );
			$image = has_post_thumbnail( $post ) ? get_the_post_thumbnail_url( $post, 'large' ) : '';
		}
	} elseif ( is_product_category() || is_tax() ) {
		$term = get_queried_object();
		$desc = $term && ! empty( $term->description ) ? wp_strip_all_tags( $term->description ) : sprintf( __( 'Browse %s from Kanz Corner Trading — industrial supply in Al-Khobar, Saudi Arabia.', 'kanz-corner' ), single_term_title( '', false ) );
		$url  = get_term_link( $term );
	} elseif ( is_front_page() ) {
		$desc = get_bloginfo( 'description' ) ?: __( 'Full-range industrial supplier of pipes, fittings, valves, flanges, fasteners, gaskets and safety solutions across Saudi Arabia.', 'kanz-corner' );
	}

	if ( ! $desc ) {
		$desc = get_bloginfo( 'description' );
	}
	$desc  = trim( mb_substr( $desc, 0, 160 ) );
	$image = $image ?: KC_THEME_URI . '/assets/images/logo-icon.png';

	echo "\n<!-- Kanz Corner SEO -->\n";
	printf( '<meta name="description" content="%s">' . "\n", esc_attr( $desc ) );
	printf( '<meta property="og:type" content="%s">' . "\n", esc_attr( $type ) );
	printf( '<meta property="og:title" content="%s">' . "\n", esc_attr( $title ) );
	printf( '<meta property="og:description" content="%s">' . "\n", esc_attr( $desc ) );
	printf( '<meta property="og:url" content="%s">' . "\n", esc_url( $url ) );
	printf( '<meta property="og:site_name" content="%s">' . "\n", esc_attr( get_bloginfo( 'name' ) ) );
	if ( $image ) {
		printf( '<meta property="og:image" content="%s">' . "\n", esc_url( $image ) );
	}
	printf( '<meta name="twitter:card" content="%s">' . "\n", $image ? 'summary_large_image' : 'summary' );
	printf( '<meta name="twitter:title" content="%s">' . "\n", esc_attr( $title ) );
	printf( '<meta name="twitter:description" content="%s">' . "\n", esc_attr( $desc ) );
	if ( $image ) {
		printf( '<meta name="twitter:image" content="%s">' . "\n", esc_url( $image ) );
	}
}
add_action( 'wp_head', 'kc_seo_meta_tags', 1 );

/* ------------------------------------------------------------------------
 * Organization structured data (site-wide).
 * ---------------------------------------------------------------------- */
function kc_schema_organization() {
	if ( kc_seo_plugin_active() || ! is_front_page() ) {
		return;
	}
	$data = array(
		'@context' => 'https://schema.org',
		'@type'    => 'Organization',
		'name'     => get_bloginfo( 'name' ),
		'url'      => home_url( '/' ),
		'logo'     => KC_THEME_URI . '/assets/images/logo-icon.png',
		'email'    => get_theme_mod( 'kc_email', 'sales@kanzcorner.com' ),
		'telephone'=> get_theme_mod( 'kc_phone', '+966 50 726 4938' ),
		'address'  => array(
			'@type'           => 'PostalAddress',
			'streetAddress'   => get_theme_mod( 'kc_address_full', 'B/W Prince Saad / Prince Talal Bin Abdulaziz Street, Cross 4' ),
			'addressLocality' => 'Al-Khobar',
			'addressRegion'   => 'Eastern Province',
			'addressCountry'  => 'SA',
		),
	);
	$socials = array_filter( array(
		get_theme_mod( 'kc_social_instagram', '' ),
		get_theme_mod( 'kc_social_linkedin', '' ),
		get_theme_mod( 'kc_social_twitter', '' ),
	) );
	if ( $socials ) {
		$data['sameAs'] = array_values( $socials );
	}
	echo '<script type="application/ld+json">' . wp_json_encode( $data ) . '</script>' . "\n";
}
add_action( 'wp_head', 'kc_schema_organization', 20 );

/* ------------------------------------------------------------------------
 * Product structured data.
 * ---------------------------------------------------------------------- */
function kc_schema_product() {
	if ( kc_seo_plugin_active() || ! function_exists( 'is_product' ) || ! is_product() ) {
		return;
	}
	global $product;
	if ( ! $product ) {
		return;
	}

	$data = array(
		'@context'    => 'https://schema.org',
		'@type'       => 'Product',
		'name'        => $product->get_name(),
		'sku'         => $product->get_sku(),
		'description' => wp_strip_all_tags( $product->get_short_description() ?: $product->get_description() ),
		'image'       => kc_get_product_placeholder_image( $product->get_id() ),
		'brand'       => array( '@type' => 'Brand', 'name' => 'Kanz Corner Trading' ),
	);

	if ( ! kc_product_is_quote_only( $product->get_id() ) && '' !== $product->get_price() ) {
		$data['offers'] = array(
			'@type'         => 'Offer',
			'price'         => $product->get_price(),
			'priceCurrency' => get_woocommerce_currency(),
			'availability'  => $product->is_in_stock() ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
			'url'           => get_permalink( $product->get_id() ),
		);
	} else {
		// Quote-only: advertise it as available to order without a fixed price.
		$data['offers'] = array(
			'@type'         => 'Offer',
			'availability'  => 'https://schema.org/InStock',
			'url'           => get_permalink( $product->get_id() ),
			'priceCurrency' => get_woocommerce_currency(),
			'price'         => '0',
			'priceSpecification' => array(
				'@type' => 'PriceSpecification',
				'valueAddedTaxIncluded' => true,
			),
		);
	}

	echo '<script type="application/ld+json">' . wp_json_encode( $data ) . '</script>' . "\n";
}
add_action( 'wp_head', 'kc_schema_product', 20 );

/* ------------------------------------------------------------------------
 * Breadcrumb structured data on inner pages.
 * ---------------------------------------------------------------------- */
function kc_schema_breadcrumbs() {
	if ( kc_seo_plugin_active() || is_front_page() ) {
		return;
	}
	$items = array();
	$items[] = array( 'name' => __( 'Home', 'kanz-corner' ), 'url' => home_url( '/' ) );

	if ( function_exists( 'is_product' ) && is_product() ) {
		$terms = get_the_terms( get_the_ID(), 'product_cat' );
		if ( $terms && ! is_wp_error( $terms ) ) {
			$t = $terms[0];
			$items[] = array( 'name' => $t->name, 'url' => get_term_link( $t ) );
		}
		$items[] = array( 'name' => get_the_title(), 'url' => get_permalink() );
	} elseif ( is_product_category() || is_tax() || is_category() ) {
		$items[] = array( 'name' => single_term_title( '', false ), 'url' => get_term_link( get_queried_object() ) );
	} elseif ( is_singular() ) {
		$items[] = array( 'name' => get_the_title(), 'url' => get_permalink() );
	} else {
		return;
	}

	$elements = array();
	foreach ( $items as $i => $item ) {
		$elements[] = array(
			'@type'    => 'ListItem',
			'position' => $i + 1,
			'name'     => $item['name'],
			'item'     => $item['url'],
		);
	}
	$data = array(
		'@context'        => 'https://schema.org',
		'@type'           => 'BreadcrumbList',
		'itemListElement' => $elements,
	);
	echo '<script type="application/ld+json">' . wp_json_encode( $data ) . '</script>' . "\n";
}
add_action( 'wp_head', 'kc_schema_breadcrumbs', 21 );
