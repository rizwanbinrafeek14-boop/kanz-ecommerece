<?php
/**
 * Contact — auto-selected for a Page with slug "contact".
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();
?>

<div class="container" style="padding-top:32px">
	<div class="breadcrumbs">
		<a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( 'Home', 'kanz-corner' ); ?></a><span>/</span>
		<span><?php esc_html_e( 'Contact', 'kanz-corner' ); ?></span>
	</div>
</div>

<section class="section" style="padding-top:16px">
	<div class="container" style="display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:start">
		<div>
			<span class="eyebrow"><?php esc_html_e( 'Get in touch', 'kanz-corner' ); ?></span>
			<h1 class="section-title" style="margin-bottom:16px"><?php esc_html_e( "We're here to help.", 'kanz-corner' ); ?></h1>
			<p class="section-desc" style="margin-bottom:32px"><?php esc_html_e( 'Reach our technical sales team directly, or send a message and we will get back to you within 1 business day.', 'kanz-corner' ); ?></p>

			<div style="display:grid;gap:20px;margin-bottom:32px">
				<div class="trust-item" style="max-width:none">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
					<div><b><?php esc_html_e( 'Phone', 'kanz-corner' ); ?></b><span><?php echo esc_html( get_theme_mod( 'kc_phone', '+966 50 726 4938' ) ); ?></span></div>
				</div>
				<div class="trust-item" style="max-width:none">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 6l-10 7L2 6"/><path d="M2 6h20v12H2z"/></svg>
					<div><b><?php esc_html_e( 'Email', 'kanz-corner' ); ?></b><span><?php echo esc_html( get_theme_mod( 'kc_email', 'sales@kanzcorner.com' ) ); ?></span></div>
				</div>
				<div class="trust-item" style="max-width:none">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
					<div><b><?php esc_html_e( 'Address', 'kanz-corner' ); ?></b><span><?php echo esc_html( get_theme_mod( 'kc_address_full', 'B/W Prince Saad / Prince Talal Bin Abdulaziz Street, Cross 4, Al-Khobar, Saudi Arabia' ) ); ?></span></div>
				</div>
			</div>

			<?php $wa = preg_replace( '/[^0-9]/', '', get_theme_mod( 'kc_whatsapp', '966507264938' ) ); ?>
			<a href="https://wa.me/<?php echo esc_attr( $wa ); ?>" target="_blank" rel="noopener" class="btn btn-outline">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.9-1.3A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1 1 12 20z"/></svg>
				<?php esc_html_e( 'Chat on WhatsApp', 'kanz-corner' ); ?>
			</a>

			<!-- Admin: replace this with an embedded Google Maps iframe once you have your Google Business Profile pin. -->
		</div>

		<div style="border:1px solid var(--border);border-radius:var(--radius-md);padding:32px">
			<h2 style="font-size:var(--fs-lg);margin-bottom:20px"><?php esc_html_e( 'Send a message', 'kanz-corner' ); ?></h2>
			<?php echo do_shortcode( '[kc_contact_form]' ); ?>
		</div>
	</div>
</section>

<?php get_footer(); ?>
