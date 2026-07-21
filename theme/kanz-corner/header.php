<?php
/**
 * The header: announcement bar, main nav, search/account/quote/cart icons.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1">
<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>

<a class="skip-link screen-reader-text" href="#main"><?php esc_html_e( 'Skip to content', 'kanz-corner' ); ?></a>

<header class="site-header">
	<div class="header-top">
		<div class="container">
			<div class="header-top-links">
				<?php $kc_phone = get_theme_mod( 'kc_phone', '+966 50 726 4938' ); ?>
				<a href="tel:<?php echo esc_attr( preg_replace( '/\s+/', '', $kc_phone ) ); ?>">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
					<?php echo esc_html( $kc_phone ); ?>
				</a>
				<?php $kc_email = get_theme_mod( 'kc_email', 'sales@kanzcorner.com' ); ?>
				<a href="mailto:<?php echo esc_attr( $kc_email ); ?>">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 6l-10 7L2 6"/><path d="M2 6h20v12H2z"/></svg>
					<?php echo esc_html( $kc_email ); ?>
				</a>
				<span class="header-location">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
					<?php echo esc_html( get_theme_mod( 'kc_address_short', __( 'Al-Khobar, Saudi Arabia', 'kanz-corner' ) ) ); ?>
				</span>
			</div>

			<?php kc_render_language_switcher(); ?>
		</div>
	</div>

	<div class="header-main">
		<div class="container">
			<a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="site-logo">
				<?php
				if ( has_custom_logo() ) {
					the_custom_logo();
				} else {
					echo '<img src="' . esc_url( KC_THEME_URI . '/assets/images/logo-icon.png' ) . '" alt="' . esc_attr( get_bloginfo( 'name' ) ) . '">';
					echo '<span class="site-logo-text">Kanz Corner<span>' . esc_html__( 'Trading', 'kanz-corner' ) . '</span></span>';
				}
				?>
			</a>

			<nav class="main-nav" aria-label="<?php esc_attr_e( 'Primary', 'kanz-corner' ); ?>">
				<?php
				if ( has_nav_menu( 'primary' ) ) {
					wp_nav_menu( array(
						'theme_location' => 'primary',
						'container'      => false,
						'items_wrap'     => '<ul>%3$s</ul>',
					) );
				} else {
					kc_default_primary_menu();
				}
				?>
			</nav>

			<div class="header-actions">
				<button class="icon-btn header-search" aria-label="<?php esc_attr_e( 'Search', 'kanz-corner' ); ?>" data-open-search>
					<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
				</button>
				<a href="<?php echo esc_url( function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'myaccount' ) : '#' ); ?>" class="icon-btn header-account" aria-label="<?php esc_attr_e( 'My Account', 'kanz-corner' ); ?>">
					<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
				</a>
				<button class="icon-btn" aria-label="<?php esc_attr_e( 'Quote list', 'kanz-corner' ); ?>" data-open-quote-drawer>
					<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="9" y1="11" x2="15" y2="11"/></svg>
					<span class="count js-quote-count"><?php echo esc_html( kc_get_quote_list_count() ); ?></span>
				</button>
				<?php if ( class_exists( 'WooCommerce' ) ) : ?>
				<a href="<?php echo esc_url( wc_get_cart_url() ); ?>" class="icon-btn" aria-label="<?php esc_attr_e( 'Cart', 'kanz-corner' ); ?>" data-open-cart-drawer>
					<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
					<span class="count kc-cart-count"><?php echo absint( WC()->cart ? WC()->cart->get_cart_contents_count() : 0 ); ?></span>
				</a>
				<?php endif; ?>
				<button class="mobile-nav-toggle icon-btn" aria-label="<?php esc_attr_e( 'Menu', 'kanz-corner' ); ?>" aria-expanded="false">
					<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
				</button>
			</div>
		</div>
	</div>
</header>

<main id="main">
