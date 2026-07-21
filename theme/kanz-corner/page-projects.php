<?php
/**
 * Projects / Clients — auto-selected for a Page with slug "projects".
 * Ships empty/ready: swap $projects for real entries as you complete work,
 * or convert to a CPT loop later if the list grows large (see
 * docs/ADMIN-GUIDE.md).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();

// Add real projects here as they complete — each becomes a card below.
$projects = array();
?>

<div class="container" style="padding-top:32px">
	<div class="breadcrumbs">
		<a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( 'Home', 'kanz-corner' ); ?></a><span>/</span>
		<span><?php esc_html_e( 'Projects', 'kanz-corner' ); ?></span>
	</div>
</div>

<section class="section" style="padding-top:16px">
	<div class="container">
		<span class="eyebrow"><?php esc_html_e( 'Our work', 'kanz-corner' ); ?></span>
		<h1 class="section-title" style="max-width:20ch;margin-bottom:16px"><?php esc_html_e( 'Projects & clients.', 'kanz-corner' ); ?></h1>
		<p class="section-desc" style="max-width:70ch;margin-bottom:40px"><?php esc_html_e( 'A look at the contractors, developers and industrial operators we\'ve supplied across the Eastern Province and beyond.', 'kanz-corner' ); ?></p>

		<?php if ( ! empty( $projects ) ) : ?>
			<div class="product-grid">
				<?php foreach ( $projects as $project ) : ?>
					<div class="product-card">
						<div class="thumb"><img src="<?php echo esc_url( $project['image'] ); ?>" alt="<?php echo esc_attr( $project['title'] ); ?>"></div>
						<div class="body">
							<span class="cat-label"><?php echo esc_html( $project['sector'] ); ?></span>
							<h3><?php echo esc_html( $project['title'] ); ?></h3>
							<span class="spec-line"><?php echo esc_html( $project['summary'] ); ?></span>
						</div>
					</div>
				<?php endforeach; ?>
			</div>
		<?php else : ?>
			<div style="border:1px dashed var(--border);border-radius:var(--radius-md);padding:48px;text-align:center;color:var(--text-muted)">
				<p style="margin-bottom:16px"><?php esc_html_e( 'Project case studies are coming soon.', 'kanz-corner' ); ?></p>
				<p style="font-size:13px"><?php esc_html_e( 'Admin: add entries to the $projects array in page-projects.php, or ask your developer to convert this into an editable post type once you have several.', 'kanz-corner' ); ?></p>
			</div>
		<?php endif; ?>
	</div>
</section>

<?php get_footer(); ?>
