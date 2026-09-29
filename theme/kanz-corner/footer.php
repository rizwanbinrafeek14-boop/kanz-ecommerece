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
					<div style="display:flex;align-items:center;gap:12px">
						<img src="<?php echo esc_url( KC_THEME_URI . '/assets/images/logo-icon.png' ); ?>" alt="" style="height:44px;width:auto">
						<span style="color:#fff;font-weight:800;font-size:18px;line-height:1.2">KANZ CORNER<br><span style="font-weight:600;font-size:11px;letter-spacing:3px;color:var(--kc-grey-400)">TRADING</span></span>
					</div>
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
				<h4><?php esc_html_e( 'Contact Us', 'kanz-corner' ); ?></h4>
				<ul class="footer-contact">
					<?php $kc_f_wa = preg_replace( '/[^0-9]/', '', get_theme_mod( 'kc_whatsapp', '966507264938' ) ); ?>
					<li>
						<span class="fc-ic"><svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.9-1.3A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1 1 12 20z"/></svg></span>
						<a href="https://wa.me/<?php echo esc_attr( $kc_f_wa ); ?>" target="_blank" rel="noopener"><b><?php echo esc_html( get_theme_mod( 'kc_phone', '+966 50 726 4938' ) ); ?></b><span><?php esc_html_e( 'WhatsApp Support', 'kanz-corner' ); ?></span></a>
					</li>
					<li>
						<span class="fc-ic"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 6l-10 7L2 6"/><path d="M2 6h20v12H2z"/></svg></span>
						<a href="mailto:<?php echo esc_attr( get_theme_mod( 'kc_email', 'sales@kanzcorner.com' ) ); ?>"><b><?php echo esc_html( get_theme_mod( 'kc_email', 'sales@kanzcorner.com' ) ); ?></b><span><?php esc_html_e( 'Email Us', 'kanz-corner' ); ?></span></a>
					</li>
					<li>
						<span class="fc-ic"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
						<span class="fc-txt"><b><?php echo esc_html( get_theme_mod( 'kc_hours', __( 'Sun – Thu: 8:00 AM – 6:00 PM', 'kanz-corner' ) ) ); ?></b><span><?php esc_html_e( 'Working Hours', 'kanz-corner' ); ?></span></span>
					</li>
					<li>
						<span class="fc-ic"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg></span>
						<span class="fc-txt"><b><?php echo esc_html( get_theme_mod( 'kc_address_short', __( 'Al-Khobar, Saudi Arabia', 'kanz-corner' ) ) ); ?></b><span><?php esc_html_e( 'Warehouse & Office', 'kanz-corner' ); ?></span></span>
					</li>
				</ul>
			</div>

			<div>
				<h4><?php esc_html_e( 'Quick Links', 'kanz-corner' ); ?></h4>
				<?php if ( has_nav_menu( 'footer-company' ) ) : ?>
					<?php wp_nav_menu( array( 'theme_location' => 'footer-company', 'container' => false, 'items_wrap' => '<ul>%3$s</ul>' ) ); ?>
				<?php else : ?>
					<ul>
						<li><a href="<?php echo esc_url( home_url( '/about-us/' ) ); ?>"><?php esc_html_e( 'About Us', 'kanz-corner' ); ?></a></li>
						<li><a href="<?php echo esc_url( home_url( '/request-a-quote/' ) ); ?>"><?php esc_html_e( 'Request a Quote', 'kanz-corner' ); ?></a></li>
						<li><a href="<?php echo esc_url( home_url( '/certifications/' ) ); ?>"><?php esc_html_e( 'Brands & Certifications', 'kanz-corner' ); ?></a></li>
						<li><a href="<?php echo esc_url( home_url( '/projects/' ) ); ?>"><?php esc_html_e( 'Projects', 'kanz-corner' ); ?></a></li>
						<li><a href="<?php echo esc_url( get_permalink( get_option( 'page_for_posts' ) ) ); ?>"><?php esc_html_e( 'Blog', 'kanz-corner' ); ?></a></li>
						<li><a href="<?php echo esc_url( home_url( '/contact/' ) ); ?>"><?php esc_html_e( 'Contact', 'kanz-corner' ); ?></a></li>
						<li><a href="<?php echo esc_url( function_exists( 'wc_get_page_permalink' ) ? wc_get_page_permalink( 'myaccount' ) : '#' ); ?>"><?php esc_html_e( 'B2B Trade Account', 'kanz-corner' ); ?></a></li>
					</ul>
				<?php endif; ?>
			</div>

			<div>
				<h4><?php esc_html_e( 'Products', 'kanz-corner' ); ?></h4>
				<?php if ( has_nav_menu( 'footer-products' ) ) : ?>
					<?php wp_nav_menu( array( 'theme_location' => 'footer-products', 'container' => false, 'items_wrap' => '<ul>%3$s</ul>' ) ); ?>
				<?php elseif ( taxonomy_exists( 'product_cat' ) ) : ?>
					<ul>
						<?php
						// parent => 0: only the 8 top-level categories, not alphabetical subcategories.
						$footer_cats = get_terms( array( 'taxonomy' => 'product_cat', 'hide_empty' => false, 'parent' => 0, 'number' => 8, 'exclude' => array( get_option( 'default_product_cat' ) ) ) );
						foreach ( $footer_cats as $cat ) :
							?>
							<li><a href="<?php echo esc_url( get_term_link( $cat ) ); ?>"><?php echo esc_html( $cat->name ); ?></a></li>
						<?php endforeach; ?>
					</ul>
				<?php endif; ?>
			</div>
		</div>

		<div class="footer-mid">
			<div class="footer-mid-cell">
				<h4><?php esc_html_e( 'Subscribe to our newsletter', 'kanz-corner' ); ?></h4>
				<p><?php esc_html_e( 'New product lines, offers and industry updates.', 'kanz-corner' ); ?></p>
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
			<div class="footer-mid-cell">
				<h4><?php esc_html_e( 'We Accept', 'kanz-corner' ); ?></h4>
				<div class="kc-accept">
					<span>mada</span><span>VISA</span><span>Mastercard</span><span>STC Pay</span><span>Apple Pay</span><span><?php esc_html_e( 'Bank Transfer', 'kanz-corner' ); ?></span><span><?php esc_html_e( 'COD', 'kanz-corner' ); ?></span>
				</div>
			</div>
			<?php $kc_maroof = get_theme_mod( 'kc_maroof_url', '' ); ?>
			<?php if ( $kc_maroof ) : ?>
			<div class="footer-mid-cell">
				<h4><?php esc_html_e( 'Trust & Verification', 'kanz-corner' ); ?></h4>
				<a class="kc-maroof-card" href="<?php echo esc_url( $kc_maroof ); ?>" target="_blank" rel="noopener">
					<span class="kc-maroof-badge"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg></span>
					<span><b><?php esc_html_e( 'Verified on Maroof', 'kanz-corner' ); ?></b><span><?php esc_html_e( 'Registered e-commerce store in Saudi Arabia', 'kanz-corner' ); ?></span></span>
				</a>
			</div>
			<?php endif; ?>
		</div>

		<div class="footer-bottom">
			<span>&copy; <?php echo esc_html( gmdate( 'Y' ) ); ?> <?php bloginfo( 'name' ); ?>. <?php esc_html_e( 'All rights reserved.', 'kanz-corner' ); ?></span>
			<span class="footer-vat-note"><?php esc_html_e( 'All prices include 15% Saudi VAT.', 'kanz-corner' ); ?></span>
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

<button type="button" class="kc-backtop" aria-label="<?php esc_attr_e( 'Back to top', 'kanz-corner' ); ?>">
	<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
</button>

<div class="drawer-overlay" data-for="wish-drawer"></div>
<aside class="drawer" id="wish-drawer" aria-label="<?php esc_attr_e( 'Wishlist', 'kanz-corner' ); ?>">
	<div class="drawer-head">
		<strong><?php esc_html_e( 'Your Wishlist', 'kanz-corner' ); ?></strong>
		<button data-drawer-close aria-label="<?php esc_attr_e( 'Close', 'kanz-corner' ); ?>">&times;</button>
	</div>
	<div class="drawer-body js-wish-body"></div>
	<div class="drawer-foot">
		<a href="<?php echo esc_url( home_url( '/request-a-quote/' ) ); ?>" class="btn btn-primary btn-block"><?php esc_html_e( 'Request Quote for Saved Items', 'kanz-corner' ); ?></a>
	</div>
</aside>

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
