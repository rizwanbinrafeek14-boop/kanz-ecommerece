<?php
/**
 * About Us — auto-selected by WordPress for a Page with the slug
 * "about-us" (Template Hierarchy: page-{slug}.php). Create that page in
 * Pages → Add New with slug "about-us"; whatever you type into its editor
 * is ignored in favor of this richer layout, but the page still needs to
 * exist so /about-us/ resolves and shows up in menus.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();
?>

<div class="container" style="padding-top:32px">
	<div class="breadcrumbs">
		<a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( 'Home', 'kanz-corner' ); ?></a><span>/</span>
		<span><?php esc_html_e( 'About Us', 'kanz-corner' ); ?></span>
	</div>
</div>

<section class="section" style="padding-top:16px">
	<div class="container">
		<span class="eyebrow"><?php esc_html_e( 'About Kanz Corner', 'kanz-corner' ); ?></span>
		<h1 class="section-title" style="max-width:16ch;margin-bottom:24px"><?php esc_html_e( 'Empowering industries, shaping futures.', 'kanz-corner' ); ?></h1>

		<div style="display:grid;grid-template-columns:1.1fr .9fr;gap:48px;align-items:start">
			<div style="color:var(--text);line-height:var(--lh-normal);font-size:var(--fs-md)">
				<?php
				// Editable via the normal WordPress editor (Pages -> About Us -> edit).
				// The catalogue-derived starter copy below (see docs/ADMIN-GUIDE.md ->
				// "Editing the About Us page") is only a fallback for a brand-new,
				// still-empty page so the site never looks broken before you've written
				// your own version.
				if ( have_posts() ) :
					the_post();
					if ( has_excerpt() || trim( wp_strip_all_tags( get_the_content() ) ) ) {
						the_content();
					} else {
						?>
						<p><?php esc_html_e( 'KANZ CORNER EST. is a full-range industrial supplier headquartered in Al-Khobar, Eastern Province, Saudi Arabia. We serve the Kingdom\'s most demanding sectors — oil & gas, petrochemical, construction, water treatment, and infrastructure — with an unwavering commitment to quality and reliability.', 'kanz-corner' ); ?></p>
						<p><?php esc_html_e( 'Our product portfolio spans the complete spectrum of industrial needs: valves, carbon steel and stainless steel pipes, pipe fittings, flanges, sheets, tubes, fasteners, gaskets, gauges, safety equipment, and welding solutions. Every product we supply is sourced from internationally certified manufacturers and meets the rigorous standards required by Saudi Arabia\'s industrial landscape.', 'kanz-corner' ); ?></p>
						<p><?php esc_html_e( 'At KANZ CORNER EST., we go beyond simply supplying products. Our team of experienced professionals provides technical guidance, product selection support, and responsive after-sales service — ensuring your project runs on time and within specification. We take pride in being the partner that contractors, engineers, and procurement specialists can count on.', 'kanz-corner' ); ?></p>
						<p><?php esc_html_e( 'At KANZ CORNER EST., we are committed to supporting Saudi Arabia\'s Vision 2030 by providing innovative, high-quality products and services that contribute to the nation\'s growth and sustainability. Through strategic partnerships and cutting-edge solutions, we aim to play an integral role in shaping a prosperous future, fostering economic diversification, and empowering industries across Saudi Arabia.', 'kanz-corner' ); ?></p>
						<?php
					}
					rewind_posts();
				endif;
				?>
			</div>

			<div class="hero-card" style="background:var(--bg-subtle);border-color:var(--border)">
				<h3 style="color:var(--kc-navy)"><?php esc_html_e( 'Industries we serve', 'kanz-corner' ); ?></h3>
				<ul class="hero-card-list" style="margin-top:16px">
					<?php
					$industries = array( __( 'Oil & Gas', 'kanz-corner' ), __( 'Petrochemical', 'kanz-corner' ), __( 'Construction', 'kanz-corner' ), __( 'Water Treatment', 'kanz-corner' ), __( 'Infrastructure', 'kanz-corner' ) );
					foreach ( $industries as $ind ) :
						?>
						<li style="color:var(--text)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A6242E" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> <?php echo esc_html( $ind ); ?></li>
					<?php endforeach; ?>
				</ul>
			</div>
		</div>
	</div>
</section>

<section class="section section-dark">
	<div class="container" style="display:flex;justify-content:space-around;flex-wrap:wrap;gap:32px;text-align:center">
		<div class="hero-stat"><b><?php echo esc_html( get_theme_mod( 'kc_stat_1_number', '2,500+' ) ); ?></b><span><?php esc_html_e( 'SKUs across 8 categories', 'kanz-corner' ); ?></span></div>
		<div class="hero-stat"><b><?php echo esc_html( get_theme_mod( 'kc_stat_2_number', '30+' ) ); ?></b><span><?php esc_html_e( 'Certified brands', 'kanz-corner' ); ?></span></div>
		<div class="hero-stat"><b>2026</b><span><?php esc_html_e( 'Serving Al-Khobar & the Eastern Province', 'kanz-corner' ); ?></span></div>
	</div>
</section>

<section class="section">
	<div class="container">
		<div class="quote-cta">
			<div>
				<h2><?php esc_html_e( 'Have a project in mind?', 'kanz-corner' ); ?></h2>
				<p><?php esc_html_e( 'Tell us what you need and our technical team will follow up within 24 hours.', 'kanz-corner' ); ?></p>
			</div>
			<a href="<?php echo esc_url( home_url( '/request-a-quote/' ) ); ?>" class="btn btn-dark"><?php esc_html_e( 'Start a Quote Request', 'kanz-corner' ); ?></a>
		</div>
	</div>
</section>

<?php get_footer(); ?>
