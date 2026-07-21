<?php
/**
 * Closes <main>, outputs the footer, floating widgets, and quote/cart drawers.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
</main>

<footer class="site-footer">
	<div class="container">
		<div class="footer-grid">
			<div class="footer-about">
				<?php if ( has_custom_logo() ) : ?>
					<div style="filter:brightness(0) invert(1)"><?php the_custom_logo(); ?></div>
				<?php else : ?>
					<img src="<?php echo esc_url( KC_THEME_URI . '/assets/images/logo-placeholder.svg' ); ?>" alt="<?php bloginfo( 'name' ); ?>" style="height:40px;filter:brightness(0) invert(1)">
				<?php endif; ?>
				<p><?php echo esc_html( get_theme_mod( 'kc_footer_tagline', __( 'Full-range industrial supplier of pipes, fittings, valves, flanges & safety solutions across Saudi Arabia.', 'kanz-corner' ) ) ); ?></p>
				<div class="footer-social">
					<?php foreach ( kc_social_links() as $network => $data ) : ?>
						<?php if ( ! empty( $data['url'] ) ) : ?>
						<a href="<?php echo esc_url( $data['url'] ); ?>" aria-label="<?php echo esc_attr( $data['label'] ); ?>" target="_blank" rel="noopener"><?php echo $data['icon']; // phpcs:ignore ?></a>
						<?php endif; ?>
					<?php endforeach; ?>
				</div>
			</div>

			<div>
				<h4><?php esc_html_e( 'Products', 'kanz-corner' ); ?></h4>
				<?php if ( has_nav_menu( 'footer-products' ) ) : ?>
					<?php wp_nav_menu( array( 'theme_location' => 'footer-products', 'container' => false, 'items_wrap' => '<ul>%3$s</ul>' ) ); ?>
				<?php elseif ( taxonomy_exists( 'product_cat' ) ) : ?>
					<ul>
						<?php
						$footer_cats = get_terms( array( 'taxonomy' => 'product_cat', 'hide_empty' => false, 'number' => 6, 'exclude' => array( get_option( 'default_product_cat' ) ) ) );
						foreach ( $footer_cats as $cat ) :
							?>
							<li><a href="<?php echo esc_url( get_term_link( $cat ) ); ?>"><?php echo esc_html( $cat->name ); ?></a></li>
						<?php endforeach; ?>
					</ul>
				<?php endif; ?>
			</div>

			<div>
				<h4><?php esc_html_e( 'Company', 'kanz-corner' ); ?></h4>
				<?php if ( has_nav_menu( 'footer-company' ) ) : ?>
					<?php wp_nav_menu( array( 'theme_location' => 'footer-company', 'container' => false, 'items_wrap' => '<ul>%3$s</ul>' ) ); ?>
				<?php else : ?>
					<ul>
						<li><a href="<?php echo esc_url( home_url( '/about-us/' ) ); ?>"><?php esc_html_e( 'About Us', 'kanz-corner' ); ?></a></li>
						<li><a href="<?php echo esc_url( home_url( '/certifications/' ) ); ?>"><?php esc_html_e( 'Certifications', 'kanz-corner' ); ?></a></li>
						<li><a href="<?php echo esc_url( home_url( '/projects/' ) ); ?>"><?php esc_html_e( 'Projects', 'kanz-corner' ); ?></a></li>
						<li><a href="<?php echo esc_url( get_permalink( get_option( 'page_for_posts' ) ) ); ?>"><?php esc_html_e( 'Blog', 'kanz-corner' ); ?></a></li>
						<li><a href="<?php echo esc_url( home_url( '/contact/' ) ); ?>"><?php esc_html_e( 'Contact', 'kanz-corner' ); ?></a></li>
					</ul>
				<?php endif; ?>
			</div>

			<div>
				<h4><?php esc_html_e( 'Stay Updated', 'kanz-corner' ); ?></h4>
				<p style="font-size:14px"><?php esc_html_e( 'Get notified about new product lines and offers.', 'kanz-corner' ); ?></p>
				<?php echo do_shortcode( get_theme_mod( 'kc_newsletter_shortcode', '' ) ); ?>
				<?php if ( ! get_theme_mod( 'kc_newsletter_shortcode', '' ) ) : ?>
				<form class="newsletter-form" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
					<input type="hidden" name="action" value="kc_newsletter_signup">
					<?php wp_nonce_field( 'kc_newsletter', 'kc_newsletter_nonce' ); ?>
					<input type="email" name="email" placeholder="<?php esc_attr_e( 'Your email address', 'kanz-corner' ); ?>" required>
					<button type="submit" aria-label="<?php esc_attr_e( 'Subscribe', 'kanz-corner' ); ?>">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
					</button>
				</form>
				<?php endif; ?>
			</div>
		</div>

		<div class="footer-bottom">
			<span>&copy; <?php echo esc_html( gmdate( 'Y' ) ); ?> <?php bloginfo( 'name' ); ?>. <?php esc_html_e( 'All rights reserved.', 'kanz-corner' ); ?></span>
			<div class="payment-icons">
				<span>mada</span><span>VISA</span><span>Mastercard</span><span>STC Pay</span><span>Apple Pay</span>
			</div>
		</div>
	</div>
</footer>

<div class="fab-stack">
	<?php $kc_wa = preg_replace( '/[^0-9]/', '', get_theme_mod( 'kc_whatsapp', '966507264938' ) ); ?>
	<?php if ( $kc_wa && get_theme_mod( 'kc_show_whatsapp', true ) ) : ?>
	<a class="fab fab-whatsapp" href="https://wa.me/<?php echo esc_attr( $kc_wa ); ?>" aria-label="<?php esc_attr_e( 'Chat on WhatsApp', 'kanz-corner' ); ?>" target="_blank" rel="noopener">
		<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.9-1.3A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1 1 12 20z"/></svg>
	</a>
	<?php endif; ?>
	<button class="fab fab-quote" data-open-quote-drawer aria-label="<?php esc_attr_e( 'Quote list', 'kanz-corner' ); ?>">
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
		<span class="count js-quote-count"><?php echo esc_html( kc_get_quote_list_count() ); ?></span>
	</button>
</div>

<div class="drawer-overlay" data-for="quote-drawer"></div>
<aside class="drawer" id="quote-drawer" aria-label="<?php esc_attr_e( 'Quote request list', 'kanz-corner' ); ?>">
	<div class="drawer-head">
		<strong><?php esc_html_e( 'Your Quote List', 'kanz-corner' ); ?></strong>
		<button data-drawer-close aria-label="<?php esc_attr_e( 'Close', 'kanz-corner' ); ?>">&times;</button>
	</div>
	<div class="drawer-body"><?php kc_render_quote_drawer_items(); ?></div>
	<div class="drawer-foot">
		<a href="<?php echo esc_url( home_url( '/request-a-quote/' ) ); ?>" class="btn btn-primary btn-block"><?php esc_html_e( 'Submit Quote Request', 'kanz-corner' ); ?></a>
	</div>
</aside>

<?php if ( class_exists( 'WooCommerce' ) ) : ?>
<div class="drawer-overlay" data-for="cart-drawer"></div>
<aside class="drawer" id="cart-drawer" aria-label="<?php esc_attr_e( 'Shopping cart', 'kanz-corner' ); ?>">
	<div class="drawer-head">
		<strong><?php esc_html_e( 'Your Cart', 'kanz-corner' ); ?></strong>
		<button data-drawer-close aria-label="<?php esc_attr_e( 'Close', 'kanz-corner' ); ?>">&times;</button>
	</div>
	<div class="drawer-body">
		<?php the_widget( 'WC_Widget_Cart', array( 'title' => '' ) ); ?>
	</div>
</aside>
<?php endif; ?>

<?php wp_footer(); ?>
</body>
</html>
