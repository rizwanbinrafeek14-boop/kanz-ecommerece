<?php
/**
 * Generic page template.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();
?>

<div class="container" style="padding-block:32px 64px;max-width:900px">
	<div class="breadcrumbs">
		<a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( 'Home', 'kanz-corner' ); ?></a><span>/</span>
		<span><?php the_title(); ?></span>
	</div>

	<?php while ( have_posts() ) : the_post(); ?>
		<h1 class="section-title" style="margin-bottom:24px"><?php the_title(); ?></h1>
		<div class="entry-content" style="color:var(--text);line-height:var(--lh-normal)">
			<?php the_content(); ?>
		</div>
	<?php endwhile; ?>
</div>

<?php get_footer(); ?>
