<?php
/**
 * Fallback template (required by WordPress). Used for the blog index and
 * any query WordPress can't match to a more specific template.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();
?>

<div class="container" style="padding-block:32px 64px">
	<div class="section-head" style="margin-bottom:32px">
		<div>
			<span class="eyebrow"><?php esc_html_e( 'Kanz Corner Blog', 'kanz-corner' ); ?></span>
			<h1 class="section-title"><?php echo is_search() ? esc_html__( 'Search Results', 'kanz-corner' ) : esc_html__( 'Industry News & Updates', 'kanz-corner' ); ?></h1>
		</div>
	</div>

	<?php if ( have_posts() ) : ?>
		<div class="product-grid">
			<?php
			while ( have_posts() ) :
				the_post();
				?>
				<article <?php post_class( 'product-card' ); ?>>
					<a href="<?php the_permalink(); ?>" class="thumb">
						<?php if ( has_post_thumbnail() ) : ?>
							<?php the_post_thumbnail( 'kc-card', array( 'style' => 'width:100%;height:100%;object-fit:cover' ) ); ?>
						<?php else : ?>
							<img src="<?php echo esc_url( KC_THEME_URI . '/assets/images/categories/other.svg' ); ?>" alt="">
						<?php endif; ?>
					</a>
					<div class="body">
						<span class="cat-label"><?php echo esc_html( get_the_date() ); ?></span>
						<h3><a href="<?php the_permalink(); ?>" style="color:inherit"><?php the_title(); ?></a></h3>
						<p class="spec-line" style="-webkit-line-clamp:3;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden"><?php echo esc_html( get_the_excerpt() ); ?></p>
						<div class="price-row">
							<a href="<?php the_permalink(); ?>" class="btn btn-outline btn-sm"><?php esc_html_e( 'Read More', 'kanz-corner' ); ?></a>
						</div>
					</div>
				</article>
			<?php endwhile; ?>
		</div>
		<div style="margin-top:40px"><?php the_posts_pagination(); ?></div>
	<?php else : ?>
		<p><?php esc_html_e( 'Nothing found.', 'kanz-corner' ); ?></p>
	<?php endif; ?>
</div>

<?php get_footer(); ?>
