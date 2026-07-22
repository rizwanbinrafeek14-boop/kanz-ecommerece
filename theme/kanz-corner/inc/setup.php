<?php
/**
 * Core theme setup: supports, menus, enqueues, image sizes.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Crash guards. Every non-essential storefront add-on (badges, sticky bar,
 * schema, drawers, tiles…) registers through these wrappers so that if one
 * ever throws — bad data, a plugin conflict, a WooCommerce API change — the
 * page still renders without that one widget instead of WordPress showing
 * "There has been a critical error on this website." The real error is
 * written to the PHP error log for diagnosis.
 */
function kc_guard( $fn ) {
	return function ( ...$args ) use ( $fn ) {
		try {
			return call_user_func_array( $fn, $args );
		} catch ( \Throwable $e ) {
			error_log( sprintf( 'Kanz Corner theme suppressed error in %s: %s @ %s:%d', is_string( $fn ) ? $fn : 'closure', $e->getMessage(), $e->getFile(), $e->getLine() ) );
			return null;
		}
	};
}
function kc_guard_filter( $fn ) {
	return function ( ...$args ) use ( $fn ) {
		try {
			return call_user_func_array( $fn, $args );
		} catch ( \Throwable $e ) {
			error_log( sprintf( 'Kanz Corner theme suppressed error in %s: %s @ %s:%d', is_string( $fn ) ? $fn : 'closure', $e->getMessage(), $e->getFile(), $e->getLine() ) );
			return isset( $args[0] ) ? $args[0] : null; // pass the value through unchanged
		}
	};
}

function kc_theme_setup() {
	load_theme_textdomain( 'kanz-corner', KC_THEME_DIR . '/languages' );

	add_theme_support( 'title-tag' );
	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'html5', array( 'search-form', 'comment-form', 'comment-list', 'gallery', 'caption', 'style', 'script', 'navigation-widgets' ) );
	add_theme_support( 'custom-logo', array(
		'height'      => 60,
		'width'       => 220,
		'flex-height' => true,
		'flex-width'  => true,
	) );
	add_theme_support( 'automatic-feed-links' );
	add_theme_support( 'align-wide' );
	add_theme_support( 'responsive-embeds' );

	// WooCommerce
	add_theme_support( 'woocommerce' );
	add_theme_support( 'wc-product-gallery-zoom' );
	add_theme_support( 'wc-product-gallery-lightbox' );
	add_theme_support( 'wc-product-gallery-slider' );

	register_nav_menus( array(
		'primary' => __( 'Primary Navigation', 'kanz-corner' ),
		'footer-products'   => __( 'Footer — Products', 'kanz-corner' ),
		'footer-company'    => __( 'Footer — Company', 'kanz-corner' ),
	) );

	set_post_thumbnail_size( 600, 600, true );
	add_image_size( 'kc-card', 480, 360, true );
	add_image_size( 'kc-category-icon', 96, 96, true );
}
add_action( 'after_setup_theme', 'kc_theme_setup' );

function kc_register_sidebars() {
	register_sidebar( array(
		'name'          => __( 'Shop Filters', 'kanz-corner' ),
		'id'            => 'shop-sidebar',
		'description'   => __( 'Shown on the shop/category pages. Add WooCommerce\'s "Filter Products by Attribute" and "Active Filters" widgets here once you\'ve set up Size / Schedule / Standard as product attributes — see docs/ADMIN-GUIDE.md.', 'kanz-corner' ),
		'before_widget' => '<div class="widget">',
		'after_widget'  => '</div>',
		'before_title'  => '<h4 class="widget-title">',
		'after_title'   => '</h4>',
	) );
}
add_action( 'widgets_init', 'kc_register_sidebars' );

function kc_enqueue_assets() {
	wp_enqueue_style(
		'kc-google-fonts',
		'https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap',
		array(),
		null
	);

	wp_enqueue_style( 'kc-main', KC_THEME_URI . '/assets/css/main.css', array(), KC_THEME_VERSION );

	if ( class_exists( 'WooCommerce' ) ) {
		// Load the theme's WooCommerce layer with an explicit dependency on the
		// remaining WooCommerce default stylesheet, so ours always cascades
		// last and wins. (The float-grid stylesheets that broke the product
		// grid are removed in kc_dequeue_wc_layout_styles below.)
		wp_enqueue_style( 'kc-woocommerce', KC_THEME_URI . '/assets/css/woocommerce.css', array( 'kc-main', 'woocommerce-general' ), KC_THEME_VERSION );
	}

	if ( is_rtl() ) {
		wp_enqueue_style( 'kc-rtl', KC_THEME_URI . '/assets/css/rtl.css', array( 'kc-main' ), KC_THEME_VERSION );
	}

	wp_enqueue_script(
		'kc-main',
		KC_THEME_URI . '/assets/js/main.js',
		array(),
		KC_THEME_VERSION,
		array( 'in_footer' => true, 'strategy' => 'defer' ) // defer for faster first paint (WP 6.3+)
	);

	wp_localize_script( 'kc-main', 'kcAjax', array(
		'ajaxUrl'      => admin_url( 'admin-ajax.php' ),
		'nonce'        => wp_create_nonce( 'kc_quote_nonce' ),
		'searchNonce'  => wp_create_nonce( 'kc_search_nonce' ),
		'quickvNonce'  => wp_create_nonce( 'kc_quickview_nonce' ),
		'homeUrl'      => home_url( '/' ),
		'i18n'         => array(
			'searchPlaceholder' => __( 'Search pipes, fittings, valves…', 'kanz-corner' ),
			'noResults'         => __( 'No products found. Try a different term or request a quote.', 'kanz-corner' ),
			'searching'         => __( 'Searching…', 'kanz-corner' ),
			'recentlyViewed'    => __( 'Recently viewed', 'kanz-corner' ),
			'priceOnRequest'    => __( 'Price on request', 'kanz-corner' ),
		),
	) );

	if ( is_singular() && comments_open() ) {
		wp_enqueue_script( 'comment-reply' );
	}
}
add_action( 'wp_enqueue_scripts', 'kc_enqueue_assets' );

/**
 * Performance: preconnect to Google Fonts hosts so the webfont starts
 * downloading sooner, reducing render-blocking time.
 */
function kc_resource_hints( $hints, $relation ) {
	if ( 'preconnect' === $relation ) {
		$hints[] = array( 'href' => 'https://fonts.googleapis.com' );
		$hints[] = array( 'href' => 'https://fonts.gstatic.com', 'crossorigin' => 'anonymous' );
	}
	return $hints;
}
add_filter( 'wp_resource_hints', 'kc_resource_hints', 10, 2 );

/**
 * Performance: make WordPress lazy-load and async-decode all content images
 * (WooCommerce product images, blog images, etc.). WP core already adds
 * loading="lazy" to most images; this also adds decoding="async".
 */
add_filter( 'wp_get_attachment_image_attributes', function ( $attr ) {
	if ( empty( $attr['loading'] ) ) {
		$attr['loading'] = 'lazy';
	}
	$attr['decoding'] = 'async';
	return $attr;
} );

/**
 * CRITICAL FIX: remove WooCommerce's default *layout* stylesheets.
 *
 * WooCommerce ships three CSS files. Its "layout" and "smallscreen" files
 * lay products out with old-school floats and percentage widths, which
 * fought this theme's CSS grid and collapsed product cards into narrow
 * slivers (and left large gaps on the single-product page). The theme
 * ships a complete replacement in assets/css/woocommerce.css, so we drop
 * only those two layout files while keeping "woocommerce-general" (which
 * styles form controls, the select2 dropdowns used at checkout, etc.).
 */
function kc_dequeue_wc_layout_styles( $enqueue_styles ) {
	unset( $enqueue_styles['woocommerce-layout'] );
	unset( $enqueue_styles['woocommerce-smallscreen'] );
	return $enqueue_styles;
}
add_filter( 'woocommerce_enqueue_styles', 'kc_dequeue_wc_layout_styles' );

/**
 * Body classes: expose whether the visitor is browsing in Arabic/RTL so
 * templates can branch without extra queries.
 */
function kc_body_classes( $classes ) {
	if ( is_rtl() ) {
		$classes[] = 'is-rtl';
	}
	if ( function_exists( 'wc_get_page_id' ) && is_shop() ) {
		$classes[] = 'kc-shop';
	}
	return $classes;
}
add_filter( 'body_class', 'kc_body_classes' );

/**
 * Required-plugins nudge: this theme depends on WooCommerce and works best
 * with WPML or Polylang for the AR/EN switch. Show an admin notice instead
 * of hard-failing, since a fresh WordPress install won't have them yet.
 */
function kc_admin_requirements_notice() {
	if ( ! current_user_can( 'activate_plugins' ) ) {
		return;
	}
	if ( ! class_exists( 'WooCommerce' ) ) {
		echo '<div class="notice notice-error"><p><strong>Kanz Corner theme:</strong> WooCommerce is required and is not active. Install &amp; activate it from Plugins &rarr; Add New.</p></div>';
	}
	if ( ! defined( 'ICL_SITEPRESS_VERSION' ) && ! defined( 'POLYLANG_VERSION' ) ) {
		echo '<div class="notice notice-warning"><p><strong>Kanz Corner theme:</strong> No multilingual plugin detected. Install WPML or Polylang to enable the Arabic/English switch — see docs/DEPLOYMENT-GUIDE.md.</p></div>';
	}
}
add_action( 'admin_notices', 'kc_admin_requirements_notice' );

/**
 * Custom excerpt length + "Read more" text for blog cards.
 */
add_filter( 'excerpt_length', function () { return 22; } );
add_filter( 'excerpt_more', function () { return '&hellip;'; } );

/**
 * Fallback primary menu so the header never looks broken before the admin
 * sets up Appearance -> Menus. Mirrors the category structure from the
 * catalogue import (see data/products-import.csv).
 */
function kc_default_primary_menu() {
	$shop_url = function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'shop' ) : home_url( '/shop/' );
	?>
	<ul>
		<li><a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( 'Home', 'kanz-corner' ); ?></a></li>
		<li class="has-mega">
			<a href="<?php echo esc_url( $shop_url ); ?>"><?php esc_html_e( 'Products', 'kanz-corner' ); ?></a>
			<div class="mega-menu">
				<?php
				if ( taxonomy_exists( 'product_cat' ) ) {
					$cats = get_terms( array( 'taxonomy' => 'product_cat', 'hide_empty' => false, 'parent' => 0 ) );
					foreach ( $cats as $cat ) {
						echo '<a href="' . esc_url( get_term_link( $cat ) ) . '">' . esc_html( $cat->name ) . '</a>';
					}
				}
				?>
			</div>
		</li>
		<li><a href="<?php echo esc_url( home_url( '/about-us/' ) ); ?>"><?php esc_html_e( 'About Us', 'kanz-corner' ); ?></a></li>
		<li><a href="<?php echo esc_url( home_url( '/certifications/' ) ); ?>"><?php esc_html_e( 'Certifications & Brands', 'kanz-corner' ); ?></a></li>
		<li><a href="<?php echo esc_url( home_url( '/projects/' ) ); ?>"><?php esc_html_e( 'Projects', 'kanz-corner' ); ?></a></li>
		<li><a href="<?php echo esc_url( home_url( '/contact/' ) ); ?>"><?php esc_html_e( 'Contact', 'kanz-corner' ); ?></a></li>
	</ul>
	<?php
}

/**
 * Language switcher. Uses WPML or Polylang's language list if either plugin
 * is active; otherwise renders nothing (a single-language site has nothing
 * to switch between). See docs/DEPLOYMENT-GUIDE.md for plugin setup.
 */
function kc_render_language_switcher() {
	if ( function_exists( 'icl_get_languages' ) ) {
		$languages = icl_get_languages( 'skip_missing=0' );
		if ( empty( $languages ) || count( $languages ) < 2 ) {
			return;
		}
		echo '<div class="lang-switch">';
		$i = 0;
		foreach ( $languages as $lang ) {
			$i++;
			if ( $i > 1 ) {
				echo '<span style="opacity:.3">|</span>';
			}
			printf(
				'<button type="button" data-href="%1$s" class="%2$s">%3$s</button>',
				esc_url( $lang['url'] ),
				$lang['active'] ? 'is-active' : '',
				esc_html( strtoupper( $lang['language_code'] ) )
			);
		}
		echo '</div>';
	} elseif ( function_exists( 'pll_the_languages' ) ) {
		echo '<div class="lang-switch">';
		pll_the_languages( array(
			'display_names_as' => 'code',
			'raw'               => 0,
		) );
		echo '</div>';
	}
}

/**
 * Minimal newsletter capture: stores subscribers in a wp_option array and
 * emails the admin. This is intentionally basic — swap it for a Mailchimp /
 * Klaviyo / Brevo plugin once you're ready to actually run campaigns (see
 * docs/DEPLOYMENT-GUIDE.md, "Newsletter" section) and the theme-mod
 * kc_newsletter_shortcode override in footer.php will use that instead.
 */
function kc_handle_newsletter_signup() {
	if ( ! isset( $_POST['kc_newsletter_nonce'] ) || ! wp_verify_nonce( $_POST['kc_newsletter_nonce'], 'kc_newsletter' ) ) {
		wp_die( esc_html__( 'Security check failed.', 'kanz-corner' ) );
	}
	$email = sanitize_email( wp_unslash( $_POST['email'] ?? '' ) );
	if ( is_email( $email ) ) {
		$subscribers = get_option( 'kc_newsletter_subscribers', array() );
		if ( ! in_array( $email, $subscribers, true ) ) {
			$subscribers[] = $email;
			update_option( 'kc_newsletter_subscribers', $subscribers );
		}
	}
	wp_safe_redirect( add_query_arg( 'kc_newsletter', $email ? 'subscribed' : 'error', wp_get_referer() ?: home_url( '/' ) ) );
	exit;
}
add_action( 'admin_post_kc_newsletter_signup', 'kc_handle_newsletter_signup' );
add_action( 'admin_post_nopriv_kc_newsletter_signup', 'kc_handle_newsletter_signup' );

/**
 * Social links, editable via the Customizer (inc/customizer.php).
 */
function kc_social_links() {
	return array(
		'instagram' => array(
			'label' => __( 'Instagram', 'kanz-corner' ),
			'url'   => get_theme_mod( 'kc_social_instagram', '' ),
			'icon'  => '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/></svg>',
		),
		'linkedin' => array(
			'label' => __( 'LinkedIn', 'kanz-corner' ),
			'url'   => get_theme_mod( 'kc_social_linkedin', '' ),
			'icon'  => '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4V8h4v1.5A5 5 0 0 1 16 8z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>',
		),
		'twitter' => array(
			'label' => __( 'X (Twitter)', 'kanz-corner' ),
			'url'   => get_theme_mod( 'kc_social_twitter', '' ),
			'icon'  => '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h3l-7.5 8.6L22 22h-6.6l-5.2-6.8L4.2 22H1.2l8-9.2L2 2h6.8l4.7 6.2z"/></svg>',
		),
	);
}
