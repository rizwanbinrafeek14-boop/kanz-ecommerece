<?php
/**
 * Request a Quote — auto-selected for a Page with slug "request-a-quote".
 * This is the landing page every "Request Quote" button/drawer links to.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();
?>

<div class="container" style="padding-top:32px">
	<div class="breadcrumbs">
		<a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( 'Home', 'kanz-corner' ); ?></a><span>/</span>
		<span><?php esc_html_e( 'Request a Quote', 'kanz-corner' ); ?></span>
	</div>
</div>

<section class="section" style="padding-top:16px">
	<div class="container" style="max-width:760px">
		<span class="eyebrow"><?php esc_html_e( 'Project pricing', 'kanz-corner' ); ?></span>
		<h1 class="section-title" style="margin-bottom:16px"><?php esc_html_e( 'Tell us what you need.', 'kanz-corner' ); ?></h1>
		<p class="section-desc" style="margin-bottom:32px"><?php esc_html_e( 'Our technical sales team reviews every request and typically replies within 24 hours with pricing, lead time, and any technical questions. If you added items via "Request Quote" while browsing, they\'ll be attached automatically.', 'kanz-corner' ); ?></p>

		<div style="border:1px solid var(--border);border-radius:var(--radius-md);padding:32px">
			<?php echo do_shortcode( '[kc_quote_form]' ); ?>
		</div>
	</div>
</section>

<?php get_footer(); ?>
