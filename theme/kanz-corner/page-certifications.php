<?php
/**
 * Certifications & Brands — auto-selected for a Page with slug
 * "certifications". Brand list pulled from the product catalogue; edit the
 * $brands_by_category array below as your supplier relationships change.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();

$standards = array( 'ASTM', 'ASME', 'API', 'DIN', 'BS', 'MSS-SP', 'AFNOR', 'UNI', 'EN' );

$brands_by_category = array(
	__( 'Pipes', 'kanz-corner' )         => array( 'Sumitomo', 'Chengdu', 'Bentler', 'Tubos', 'Interpipe', 'Mittal', 'TMK', 'TPCO', 'Al-Jazeera', 'SSP', 'Hyundai', 'JESCO', 'Tubacex', 'Sandvik', 'Sanyo', 'DEI', 'Froch', 'Ta Chen', 'Mueller', 'Yorkshire', 'Cambridge' ),
	__( 'Fittings & Flanges', 'kanz-corner' ) => array( 'ERNE', 'BKL', 'SKB', 'Benken', 'Schulz', 'TK', 'DEI', 'MEGA', 'JD', 'LAME', 'Bothwell', 'ULMA', 'National Grooved', 'DUCCO', 'Shurefix', 'LEDE', 'Shur Joint', 'MGI', 'Melesis', 'Metalfar', 'Viraj', 'Kofco' ),
	__( 'Valves', 'kanz-corner' )        => array( 'OMB', 'BFF', 'IVM', 'Kitz', 'L&T', 'AIL', 'NEWAY', 'RUX', 'APOLLO', 'DL', 'AVK' ),
);
?>

<div class="container" style="padding-top:32px">
	<div class="breadcrumbs">
		<a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( 'Home', 'kanz-corner' ); ?></a><span>/</span>
		<span><?php esc_html_e( 'Certifications & Brands', 'kanz-corner' ); ?></span>
	</div>
</div>

<section class="section" style="padding-top:16px">
	<div class="container">
		<span class="eyebrow"><?php esc_html_e( 'Quality you can verify', 'kanz-corner' ); ?></span>
		<h1 class="section-title" style="max-width:20ch;margin-bottom:16px"><?php esc_html_e( 'Certified standards, trusted brands.', 'kanz-corner' ); ?></h1>
		<p class="section-desc" style="max-width:70ch;margin-bottom:40px"><?php esc_html_e( 'Every product line we carry is manufactured to internationally recognized standards and sourced from mills and manufacturers with verifiable quality certifications. Mill test certificates (MTC) are available on request for any order.', 'kanz-corner' ); ?></p>

		<div class="cat-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:56px">
			<?php foreach ( array_slice( $standards, 0, 9 ) as $std ) : ?>
				<div class="cat-card" style="text-align:center;cursor:default">
					<h3 style="font-size:var(--fs-lg);color:var(--kc-red)"><?php echo esc_html( $std ); ?></h3>
					<p><?php esc_html_e( 'Compliant product lines available', 'kanz-corner' ); ?></p>
				</div>
			<?php endforeach; ?>
		</div>

		<?php foreach ( $brands_by_category as $group => $brands ) : ?>
			<div style="margin-bottom:40px">
				<h2 style="font-size:var(--fs-lg);margin-bottom:16px"><?php echo esc_html( $group ); ?></h2>
				<div style="display:flex;flex-wrap:wrap;gap:10px">
					<?php foreach ( $brands as $brand ) : ?>
						<span class="badge" style="background:var(--bg-subtle);color:var(--text);font-size:13px;text-transform:none;font-weight:600;padding:8px 16px"><?php echo esc_html( $brand ); ?></span>
					<?php endforeach; ?>
				</div>
			</div>
		<?php endforeach; ?>
	</div>
</section>

<?php get_footer(); ?>
