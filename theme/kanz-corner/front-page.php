<?php
/**
 * Homepage template.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();
?>

<!-- ============ Search hero (noon-style) ============ -->
<section class="kc-search-hero">
	<div class="container">
		<button type="button" class="kc-searchbar" data-open-search>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
			<?php esc_html_e( 'Search pipes, fittings, valves, flanges…', 'kanz-corner' ); ?>
		</button>
	</div>
</section>

<!-- ============ Promo banner carousel ============ -->
<section class="kc-banners">
	<div class="container">
		<div class="kc-banner-track">
			<?php
			$has_custom_banner = false;
			for ( $b = 1; $b <= 3; $b++ ) {
				$img  = get_theme_mod( "kc_banner_{$b}_image", '' );
				$link = get_theme_mod( "kc_banner_{$b}_link", '' );
				if ( ! $img ) {
					continue;
				}
				$has_custom_banner = true;
				$tag  = $link ? 'a' : 'div';
				$href = $link ? ' href="' . esc_url( $link ) . '"' : '';
				echo "<{$tag}{$href} class=\"kc-banner\"><img src=\"" . esc_url( $img ) . '" alt="" loading="lazy"></' . $tag . '>';
			}
			if ( ! $has_custom_banner ) :
				// Default branded banners until the admin uploads their own
				// (Appearance -> Customize -> Kanz Corner Settings -> Homepage Banners).
				?>
				<a href="<?php echo esc_url( function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'shop' ) : '#' ); ?>" class="kc-banner">
					<div class="kc-banner-text">
						<span class="eyebrow"><?php esc_html_e( 'Full-range industrial supply', 'kanz-corner' ); ?></span>
						<h3><?php esc_html_e( 'Pipes, fittings, valves & flanges — under one roof', 'kanz-corner' ); ?></h3>
						<p><?php esc_html_e( 'Certified brands · ASTM / ASME / API standards · Al-Khobar, KSA', 'kanz-corner' ); ?></p>
					</div>
				</a>
				<a href="<?php echo esc_url( home_url( '/request-a-quote/' ) ); ?>" class="kc-banner">
					<div class="kc-banner-text">
						<span class="eyebrow"><?php esc_html_e( 'Project & bulk orders', 'kanz-corner' ); ?></span>
						<h3><?php esc_html_e( 'Get a project quote within 24 hours', 'kanz-corner' ); ?></h3>
						<p><?php esc_html_e( 'Send your BOQ or item list — our engineers reply with pricing & lead time.', 'kanz-corner' ); ?></p>
					</div>
				</a>
				<a href="<?php echo esc_url( home_url( '/contact/' ) ); ?>" class="kc-banner">
					<div class="kc-banner-text">
						<span class="eyebrow"><?php esc_html_e( 'Pickup & freight', 'kanz-corner' ); ?></span>
						<h3><?php esc_html_e( 'Collect from Al-Khobar or ship anywhere in KSA', 'kanz-corner' ); ?></h3>
						<p><?php esc_html_e( 'Warehouse pickup, courier delivery, or freight quotes for heavy loads.', 'kanz-corner' ); ?></p>
					</div>
				</a>
			<?php endif; ?>
		</div>
		<div class="kc-banner-dots"></div>
	</div>
</section>

<?php $brands = get_theme_mod( 'kc_brand_strip', 'SUMITOMO, TUBACEX, ERNE, KITZ, SANDVIK, MUELLER, OMB, L&T, VIRAJ, APOLLO' ); ?>
<?php if ( $brands ) : ?>
<div class="brand-strip">
	<div class="container">
		<div class="track">
			<?php
			$brand_list = array_map( 'trim', explode( ',', $brands ) );
			for ( $i = 0; $i < 2; $i++ ) {
				foreach ( $brand_list as $brand ) {
					echo '<span>' . esc_html( $brand ) . '</span>';
				}
			}
			?>
		</div>
	</div>
</div>
<?php endif; ?>

<section class="section">
	<div class="container">
		<div class="section-head">
			<div>
				<span class="eyebrow"><?php esc_html_e( 'What we supply', 'kanz-corner' ); ?></span>
				<h2 class="section-title"><?php esc_html_e( 'Shop by category', 'kanz-corner' ); ?></h2>
				<p class="section-desc"><?php esc_html_e( 'Eight core product lines covering the full spectrum of industrial piping and safety needs.', 'kanz-corner' ); ?></p>
			</div>
			<a href="<?php echo esc_url( function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'shop' ) : '#' ); ?>" class="btn btn-outline"><?php esc_html_e( 'View All Products', 'kanz-corner' ); ?></a>
		</div>

		<div class="kc-photocat-grid">
			<?php
			$top_categories = taxonomy_exists( 'product_cat' )
				? get_terms( array( 'taxonomy' => 'product_cat', 'hide_empty' => false, 'parent' => 0, 'exclude' => array( get_option( 'default_product_cat' ) ) ) )
				: array();

			if ( ! is_wp_error( $top_categories ) && ! empty( $top_categories ) ) :
				foreach ( $top_categories as $cat ) :
					// Photo priority: the category's own thumbnail (set in
					// Products -> Categories), else the bundled catalogue photo,
					// else the line-art icon.
					$thumb_id = get_term_meta( $cat->term_id, 'thumbnail_id', true );
					if ( $thumb_id ) {
						$photo = wp_get_attachment_image_url( $thumb_id, 'kc-card' );
					} elseif ( file_exists( KC_THEME_DIR . '/assets/images/cat-photos/' . $cat->slug . '.jpg' ) ) {
						$photo = KC_THEME_URI . '/assets/images/cat-photos/' . $cat->slug . '.jpg';
					} else {
						$photo = KC_THEME_URI . '/assets/images/categories/' . kc_map_category_to_icon_slug( $cat->slug ) . '.svg';
					}
					?>
					<a href="<?php echo esc_url( get_term_link( $cat ) ); ?>" class="kc-photocat">
						<span class="ph"><img src="<?php echo esc_url( $photo ); ?>" alt="" loading="lazy"></span>
						<span class="nm"><?php echo esc_html( $cat->name ); ?></span>
					</a>
					<?php
				endforeach;
			else :
				?>
				<p style="color:var(--text-muted)"><?php esc_html_e( 'Product categories will appear here once added in Products → Categories.', 'kanz-corner' ); ?></p>
			<?php endif; ?>
		</div>
	</div>
</section>

<?php if ( class_exists( 'WooCommerce' ) ) : ?>
<section class="section section-subtle kc-hscroll">
	<div class="container">
		<div class="section-head">
			<div>
				<span class="eyebrow"><?php esc_html_e( 'Popular right now', 'kanz-corner' ); ?></span>
				<h2 class="section-title"><?php esc_html_e( 'Featured products', 'kanz-corner' ); ?></h2>
			</div>
			<a href="<?php echo esc_url( wc_get_page_permalink( 'shop' ) ); ?>" class="btn btn-outline"><?php esc_html_e( 'View All', 'kanz-corner' ); ?></a>
		</div>

		<?php
		$featured = new WP_Query( array(
			'post_type'      => 'product',
			'posts_per_page' => 4,
			'meta_query'     => array( array( 'key' => '_featured', 'value' => 'yes' ) ), // phpcs:ignore
		) );
		if ( ! $featured->have_posts() ) {
			$featured = new WP_Query( array( 'post_type' => 'product', 'posts_per_page' => 4, 'orderby' => 'date' ) );
		}
		?>
		<?php if ( $featured->have_posts() ) : ?>
			<ul class="products columns-4">
				<?php
				while ( $featured->have_posts() ) :
					$featured->the_post();
					wc_get_template_part( 'content', 'product' );
				endwhile;
				?>
			</ul>
			<?php wp_reset_postdata(); ?>
		<?php else : ?>
			<p style="color:var(--text-muted)"><?php esc_html_e( 'Add products in Products → Add New to feature them here.', 'kanz-corner' ); ?></p>
		<?php endif; ?>
	</div>
</section>
<?php endif; ?>

<!-- ============ Certifications & standards ============ -->
<section class="section-tight">
	<div class="container">
		<div class="kc-certs">
			<div class="kc-certs-intro">
				<span class="eyebrow"><?php esc_html_e( 'Quality you can verify', 'kanz-corner' ); ?></span>
				<h3><?php esc_html_e( 'Built to international standards', 'kanz-corner' ); ?></h3>
				<p><?php esc_html_e( 'Every product line is manufactured to recognised standards and sourced from certified mills. Mill test certificates available on request.', 'kanz-corner' ); ?></p>
			</div>
			<div class="kc-certs-badges">
				<?php foreach ( array( 'ASTM', 'ASME', 'API', 'DIN', 'BS', 'ISO', 'MSS-SP', 'EN' ) as $std ) : ?>
					<span class="kc-cert-badge"><?php echo esc_html( $std ); ?></span>
				<?php endforeach; ?>
			</div>
		</div>
	</div>
</section>

<section class="section">
	<div class="container">
		<div class="quote-cta" id="quote">
			<div>
				<h2><?php esc_html_e( "Can't find a listed price?", 'kanz-corner' ); ?></h2>
				<p><?php esc_html_e( 'Most of our industrial catalogue is quoted per project. Add items to your quote list and our engineers will get back to you within 24 hours with pricing and lead time.', 'kanz-corner' ); ?></p>
			</div>
			<a href="<?php echo esc_url( home_url( '/request-a-quote/' ) ); ?>" class="btn btn-dark" data-open-quote-drawer><?php esc_html_e( 'Start a Quote Request', 'kanz-corner' ); ?></a>
		</div>
	</div>
</section>

<section class="section section-subtle">
	<div class="container" style="display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center">
		<div>
			<span class="eyebrow"><?php esc_html_e( 'About Kanz Corner', 'kanz-corner' ); ?></span>
			<h2 class="section-title" style="margin-bottom:16px"><?php esc_html_e( 'Empowering industries, shaping futures.', 'kanz-corner' ); ?></h2>
			<p class="section-desc" style="margin-bottom:24px"><?php echo esc_html( get_theme_mod( 'kc_about_teaser', __( 'KANZ CORNER EST. is a full-range industrial supplier headquartered in Al-Khobar, Eastern Province, Saudi Arabia. We serve the Kingdom\'s most demanding sectors — oil & gas, petrochemical, construction, water treatment and infrastructure — with an unwavering commitment to quality, reliability, and support for Saudi Vision 2030.', 'kanz-corner' ) ) ); ?></p>
			<a href="<?php echo esc_url( home_url( '/about-us/' ) ); ?>" class="btn btn-outline"><?php esc_html_e( 'Read Our Story', 'kanz-corner' ); ?></a>
		</div>
		<div class="trust-row" style="border:none;flex-direction:column;gap:24px">
			<div class="trust-item" style="max-width:none">
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
				<div><b><?php esc_html_e( 'Certified sourcing', 'kanz-corner' ); ?></b><span><?php esc_html_e( 'Every product meets rigorous ASTM/ASME/API standards from internationally certified manufacturers.', 'kanz-corner' ); ?></span></div>
			</div>
			<div class="trust-item" style="max-width:none">
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
				<div><b><?php esc_html_e( 'Fast quote turnaround', 'kanz-corner' ); ?></b><span><?php esc_html_e( 'Our technical team responds to project inquiries within 24 hours, most days sooner.', 'kanz-corner' ); ?></span></div>
			</div>
			<div class="trust-item" style="max-width:none">
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
				<div><b><?php esc_html_e( 'Pickup & freight support', 'kanz-corner' ); ?></b><span><?php esc_html_e( 'Collect from our Al-Khobar warehouse or request a freight quote for bulk/heavy orders.', 'kanz-corner' ); ?></span></div>
			</div>
		</div>
	</div>
</section>

<!-- ============ Stats band ============ -->
<section class="section-tight section-dark">
	<div class="container">
		<div class="kc-stats-band">
			<div class="hero-stat"><b><?php echo esc_html( get_theme_mod( 'kc_stat_1_number', '2,500+' ) ); ?></b><span><?php esc_html_e( 'SKUs across 8 categories', 'kanz-corner' ); ?></span></div>
			<div class="hero-stat"><b><?php echo esc_html( get_theme_mod( 'kc_stat_2_number', '30+' ) ); ?></b><span><?php esc_html_e( 'Certified brands', 'kanz-corner' ); ?></span></div>
			<div class="hero-stat"><b><?php echo esc_html( get_theme_mod( 'kc_stat_3_number', '24h' ) ); ?></b><span><?php esc_html_e( 'Quote turnaround', 'kanz-corner' ); ?></span></div>
			<div class="hero-stat"><b><?php esc_html_e( 'KSA', 'kanz-corner' ); ?></b><span><?php esc_html_e( 'Al-Khobar, Eastern Province', 'kanz-corner' ); ?></span></div>
		</div>
	</div>
</section>

<!-- ============ Projects teaser ============ -->
<section class="section">
	<div class="container">
		<div class="section-head">
			<div>
				<span class="eyebrow"><?php esc_html_e( 'Our work', 'kanz-corner' ); ?></span>
				<h2 class="section-title"><?php esc_html_e( 'Trusted on projects across the Kingdom', 'kanz-corner' ); ?></h2>
				<p class="section-desc"><?php esc_html_e( 'From oil & gas and petrochemical to construction and water infrastructure — contractors and procurement teams rely on Kanz Corner for on-spec supply, on time.', 'kanz-corner' ); ?></p>
			</div>
			<a href="<?php echo esc_url( home_url( '/projects/' ) ); ?>" class="btn btn-outline"><?php esc_html_e( 'View Projects', 'kanz-corner' ); ?></a>
		</div>
		<div class="kc-sectors">
			<?php
			$sectors = array(
				__( 'Oil & Gas', 'kanz-corner' ),
				__( 'Petrochemical', 'kanz-corner' ),
				__( 'Construction', 'kanz-corner' ),
				__( 'Water Treatment', 'kanz-corner' ),
				__( 'Infrastructure', 'kanz-corner' ),
			);
			foreach ( $sectors as $sector ) :
				?>
				<div class="kc-sector"><span class="kc-sector-dot"></span><?php echo esc_html( $sector ); ?></div>
			<?php endforeach; ?>
		</div>
	</div>
</section>

<?php get_footer(); ?>
