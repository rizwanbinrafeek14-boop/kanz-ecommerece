<?php
/**
 * 404 template.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();
?>

<div class="container" style="padding-block:96px;text-align:center">
	<span class="eyebrow"><?php esc_html_e( '404 Error', 'kanz-corner' ); ?></span>
	<h1 class="section-title" style="margin-bottom:16px"><?php esc_html_e( "Page not found", 'kanz-corner' ); ?></h1>
	<p class="section-desc" style="margin:0 auto 32px"><?php esc_html_e( "The page you're looking for doesn't exist or may have moved.", 'kanz-corner' ); ?></p>
	<div style="display:flex;gap:16px;justify-content:center">
		<a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="btn btn-primary"><?php esc_html_e( 'Back to Home', 'kanz-corner' ); ?></a>
		<a href="<?php echo esc_url( function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'shop' ) : home_url( '/' ) ); ?>" class="btn btn-outline"><?php esc_html_e( 'Browse Products', 'kanz-corner' ); ?></a>
	</div>
</div>

<?php get_footer(); ?>
