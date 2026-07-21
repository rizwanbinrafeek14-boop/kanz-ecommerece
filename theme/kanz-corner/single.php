<?php
/**
 * Single blog post template.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();
?>

<div class="container" style="padding-block:32px 64px;max-width:820px">
	<?php while ( have_posts() ) : the_post(); ?>
		<div class="breadcrumbs">
			<a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( 'Home', 'kanz-corner' ); ?></a><span>/</span>
			<a href="<?php echo esc_url( get_permalink( get_option( 'page_for_posts' ) ) ); ?>"><?php esc_html_e( 'Blog', 'kanz-corner' ); ?></a><span>/</span>
			<span><?php the_title(); ?></span>
		</div>

		<article <?php post_class(); ?>>
			<span class="eyebrow"><?php echo esc_html( get_the_date() ); ?></span>
			<h1 class="section-title" style="margin-bottom:20px"><?php the_title(); ?></h1>

			<?php if ( has_post_thumbnail() ) : ?>
				<div style="border-radius:var(--radius-md);overflow:hidden;margin-bottom:32px">
					<?php the_post_thumbnail( 'large', array( 'style' => 'width:100%' ) ); ?>
				</div>
			<?php endif; ?>

			<div class="entry-content" style="color:var(--text);line-height:var(--lh-normal)">
				<?php the_content(); ?>
			</div>
		</article>

		<?php if ( comments_open() || get_comments_number() ) : ?>
			<div style="margin-top:48px"><?php comments_template(); ?></div>
		<?php endif; ?>
	<?php endwhile; ?>
</div>

<?php get_footer(); ?>
