<?php
/**
 * Kanz Corner theme bootstrap.
 * Loads the setup, WooCommerce, quote-system and B2B-account modules from /inc.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'KC_THEME_VERSION', '1.2.3' );
define( 'KC_THEME_DIR', get_template_directory() );
define( 'KC_THEME_URI', get_template_directory_uri() );

require_once KC_THEME_DIR . '/inc/setup.php';
require_once KC_THEME_DIR . '/inc/woocommerce.php';
require_once KC_THEME_DIR . '/inc/quote-system.php';
require_once KC_THEME_DIR . '/inc/b2b-accounts.php';
require_once KC_THEME_DIR . '/inc/spec-fields.php';
require_once KC_THEME_DIR . '/inc/customizer.php';
require_once KC_THEME_DIR . '/inc/enhancements.php';
require_once KC_THEME_DIR . '/inc/seo.php';
