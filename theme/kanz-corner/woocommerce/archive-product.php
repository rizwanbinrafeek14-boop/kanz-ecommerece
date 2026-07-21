<?php
/**
 * Shop / category archive — thin override of WooCommerce's own template.
 * Only adds the two-column shop-layout shell (filter sidebar + product
 * grid/toolbar); every hook WooCommerce normally fires here still fires in
 * the same order, so plugins that hook into woocommerce_before_shop_loop
 * etc. keep working untouched.
 *
 * @package Kanz_Corner
 */

defined( 'ABSPATH' ) || exit;

get_header( 'shop' );

/**
 * woocommerce_before_main_content hook.
 */
do_action( 'woocommerce_before_main_content' );
?>

<div class="breadcrumbs">
	<?php woocommerce_breadcrumb(); ?>
</div>

<div class="section-head" style="margin-bottom:24px">
	<div>
		<span class="eyebrow"><?php echo is_product_category() ? esc_html__( 'Category', 'kanz-corner' ) : esc_html__( 'Shop', 'kanz-corner' ); ?></span>
		<h1 class="section-title"><?php woocommerce_page_title(); ?></h1>
		<?php if ( is_product_category() ) : ?>
			<div class="section-desc"><?php echo wc_format_content( category_description() ); // phpcs:ignore ?></div>
		<?php endif; ?>
	</div>
</div>

<?php do_action( 'woocommerce_archive_description' ); ?>

<?php if ( woocommerce_product_loop() ) : ?>

	<div class="shop-layout">
		<?php
		// Custom working filters (category + availability). If the admin has
		// instead populated the "Shop Filters" widget area with WooCommerce
		// attribute-filter widgets, render those.
		if ( is_active_sidebar( 'shop-sidebar' ) ) {
			echo '<aside class="filter-panel">';
			dynamic_sidebar( 'shop-sidebar' );
			echo '</aside>';
		} else {
			kc_render_shop_filters();
		}
		?>

		<div>
			<div class="product-toolbar">
				<?php woocommerce_result_count(); ?>
				<?php woocommerce_catalog_ordering(); ?>
			</div>

			<?php
			do_action( 'woocommerce_before_shop_loop' );
			woocommerce_product_loop_start();

			if ( wc_get_loop_prop( 'total' ) ) {
				while ( have_posts() ) {
					the_post();
					do_action( 'woocommerce_shop_loop' );
					wc_get_template_part( 'content', 'product' );
				}
			}

			woocommerce_product_loop_end();
			do_action( 'woocommerce_after_shop_loop' );
			?>
		</div>
	</div>

<?php else : ?>

	<?php do_action( 'woocommerce_no_products_found' ); ?>

<?php endif; ?>

<?php
/**
 * woocommerce_after_main_content hook.
 */
do_action( 'woocommerce_after_main_content' );

get_footer( 'shop' );
