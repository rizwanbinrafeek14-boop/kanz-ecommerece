<?php
/**
 * Customizer: lets the admin edit contact info, WhatsApp number, socials and
 * footer text without touching code. Appearance -> Customize -> Kanz Corner Settings.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function kc_customize_register( $wp_customize ) {
	$wp_customize->add_panel( 'kc_settings', array(
		'title'    => __( 'Kanz Corner Settings', 'kanz-corner' ),
		'priority' => 30,
	) );

	/* ---- Contact ---- */
	$wp_customize->add_section( 'kc_contact', array(
		'title' => __( 'Contact Info', 'kanz-corner' ),
		'panel' => 'kc_settings',
	) );

	$contact_fields = array(
		'kc_phone'         => array( __( 'Phone number', 'kanz-corner' ), '+966 50 726 4938' ),
		'kc_email'         => array( __( 'Sales email', 'kanz-corner' ), 'sales@kanzcorner.com' ),
		'kc_address_short' => array( __( 'Short address (header)', 'kanz-corner' ), 'Al-Khobar, Saudi Arabia' ),
		'kc_address_full'  => array( __( 'Full address (footer/contact page)', 'kanz-corner' ), 'B/W Prince Saad / Prince Talal Bin Abdulaziz Street, Cross 4, Al-Khobar, Saudi Arabia' ),
		'kc_whatsapp'      => array( __( 'WhatsApp number (digits only, country code, no +)', 'kanz-corner' ), '966507264938' ),
		'kc_quote_notify_email' => array( __( 'Quote requests notification email', 'kanz-corner' ), get_option( 'admin_email' ) ),
	);
	foreach ( $contact_fields as $id => $data ) {
		$wp_customize->add_setting( $id, array( 'default' => $data[1], 'sanitize_callback' => 'sanitize_text_field' ) );
		$wp_customize->add_control( $id, array( 'label' => $data[0], 'section' => 'kc_contact', 'type' => 'text' ) );
	}

	$wp_customize->add_setting( 'kc_show_whatsapp', array( 'default' => true, 'sanitize_callback' => 'wp_validate_boolean' ) );
	$wp_customize->add_control( 'kc_show_whatsapp', array( 'label' => __( 'Show floating WhatsApp button', 'kanz-corner' ), 'section' => 'kc_contact', 'type' => 'checkbox' ) );

	/* ---- Social ---- */
	$wp_customize->add_section( 'kc_social', array(
		'title' => __( 'Social Links', 'kanz-corner' ),
		'panel' => 'kc_settings',
	) );
	foreach ( array( 'kc_social_instagram' => 'Instagram', 'kc_social_linkedin' => 'LinkedIn', 'kc_social_twitter' => 'X / Twitter' ) as $id => $label ) {
		$wp_customize->add_setting( $id, array( 'default' => '', 'sanitize_callback' => 'esc_url_raw' ) );
		$wp_customize->add_control( $id, array( 'label' => $label . ' ' . __( 'URL', 'kanz-corner' ), 'section' => 'kc_social', 'type' => 'url' ) );
	}

	/* ---- Footer / misc ---- */
	$wp_customize->add_section( 'kc_misc', array(
		'title' => __( 'Footer & Newsletter', 'kanz-corner' ),
		'panel' => 'kc_settings',
	) );
	$wp_customize->add_setting( 'kc_footer_tagline', array(
		'default'           => __( 'Full-range industrial supplier of pipes, fittings, valves, flanges & safety solutions across Saudi Arabia.', 'kanz-corner' ),
		'sanitize_callback' => 'sanitize_text_field',
	) );
	$wp_customize->add_control( 'kc_footer_tagline', array( 'label' => __( 'Footer tagline', 'kanz-corner' ), 'section' => 'kc_misc', 'type' => 'textarea' ) );

	/* ---- Homepage promo banners ---- */
	$wp_customize->add_section( 'kc_banners', array(
		'title'       => __( 'Homepage Banners', 'kanz-corner' ),
		'description' => __( 'Upload up to 3 promo banner images (recommended 1600×500px). Each can link anywhere — a category, a product, an offer page. If none are set, the theme shows built-in branded banners.', 'kanz-corner' ),
		'panel'       => 'kc_settings',
	) );
	for ( $b = 1; $b <= 3; $b++ ) {
		$wp_customize->add_setting( "kc_banner_{$b}_image", array( 'default' => '', 'sanitize_callback' => 'esc_url_raw' ) );
		$wp_customize->add_control( new WP_Customize_Image_Control( $wp_customize, "kc_banner_{$b}_image", array(
			/* translators: %d: banner number */
			'label'   => sprintf( __( 'Banner %d image', 'kanz-corner' ), $b ),
			'section' => 'kc_banners',
		) ) );
		$wp_customize->add_setting( "kc_banner_{$b}_link", array( 'default' => '', 'sanitize_callback' => 'esc_url_raw' ) );
		$wp_customize->add_control( "kc_banner_{$b}_link", array(
			/* translators: %d: banner number */
			'label'   => sprintf( __( 'Banner %d link URL', 'kanz-corner' ), $b ),
			'section' => 'kc_banners',
			'type'    => 'url',
		) );
	}

	$wp_customize->add_setting( 'kc_newsletter_shortcode', array( 'default' => '', 'sanitize_callback' => 'wp_kses_post' ) );
	$wp_customize->add_control( 'kc_newsletter_shortcode', array(
		'label'       => __( 'Newsletter signup shortcode (optional)', 'kanz-corner' ),
		'description' => __( 'Paste a shortcode from Mailchimp/Klaviyo/etc. to replace the built-in basic signup form.', 'kanz-corner' ),
		'section'     => 'kc_misc',
		'type'        => 'text',
	) );
}
add_action( 'customize_register', 'kc_customize_register' );
