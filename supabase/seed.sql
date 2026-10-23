-- Seed: structure only. NO products, prices, stock, certifications or SKUs are invented.

insert into site_settings (key, value) values
  ('public.vat_rate', '15'),
  ('public.currency', '"SAR"'),
  ('public.company_name_en', '"KANZ CORNER EST."'),
  ('public.company_name_ar', '"مؤسسة كنز كورنر"'),
  ('public.company_tagline_en', '"Providing superior metal solutions for industrial excellence."'),
  ('public.company_about_en', '"KANZ CORNER EST. is a full-range industrial supplier headquartered in Al-Khobar, Eastern Province, Saudi Arabia, serving oil & gas, petrochemical, construction, water treatment and infrastructure."'),
  ('public.company_phone', '"+966 50 726 4938"'),
  ('public.company_whatsapp', '"966507264938"'),
  ('public.company_email_sales', '"sales@kanzcorner.com"'),
  ('public.company_email_info', '"info@kanzcorner.com"'),
  ('public.company_address_en', '"B/W Prince Saad / Prince Talal Bin Abdulaziz Street, Cross 4, Al-Khobar, Saudi Arabia"'),
  ('public.company_website', '"www.kanzcorner.com"'),
  -- To be filled by the owner. Left blank on purpose; invoices show them only when present.
  ('public.vat_number', '""'),
  ('public.company_cr_number', '""'),
  ('public.seo_default_title', '"KANZ CORNER EST. | Industrial Pipes, Fittings, Valves & Flanges in Saudi Arabia"'),
  ('public.seo_default_description', '"Carbon steel and stainless steel pipes, fittings, flanges, valves, fasteners and gaskets from Al-Khobar. Request a quotation."'),
  ('public.delivery_options', '{"delivery": true, "pickup": true}'),
  ('public.payment_methods', '{"bank_transfer": true, "cod": false, "card": false, "mada": false, "apple_pay": false, "stc_pay": false}')
on conflict (key) do nothing;

insert into warehouses (code, name, is_default) values ('MAIN', 'Main warehouse', true) on conflict (code) do nothing;

-- Top-level categories (catalogue order), sort_order spaced by 10
insert into categories (slug, name_en, name_ar, sort_order, is_featured) values
  ('pipes',            'Pipes',                       'الأنابيب',                10, true),
  ('pipe-fittings',    'Pipe Fittings',               'وصلات الأنابيب',          20, true),
  ('forged-fittings',  'Forged Fittings',             'الوصلات المطروقة',        30, true),
  ('copper-grooved-fittings', 'Copper & Grooved Fittings', 'وصلات النحاس والمخددة', 40, true),
  ('plastic-fittings', 'HDPE, PVC, CPVC & PPR Fittings', 'وصلات البلاستيك (HDPE/PVC/CPVC/PPR)', 50, true),
  ('flanges',          'Flanges',                     'الفلنجات',                60, true),
  ('valves',           'Valves',                      'الصمامات',                70, true),
  ('fasteners',        'Fasteners',                   'المثبتات',                80, true),
  ('gaskets-gauges',   'Gaskets & Gauges',            'الجوانات والمقاييس',      90, true),
  ('other-products',   'Other Industrial Products',   'منتجات صناعية أخرى',      100, true)
on conflict (slug) do nothing;

-- Subcategories
with s(parent, slug, en, ar, ord) as (values
  ('pipes','pipes-carbon-steel','Carbon Steel Pipes (ERW & Seamless)','أنابيب الصلب الكربوني',1),
  ('pipes','pipes-stainless-steel','Stainless Steel Pipes','أنابيب الستانلس ستيل',2),
  ('pipes','pipes-duplex','Duplex Stainless Steel Pipes','أنابيب دوبلكس',3),
  ('pipes','pipes-copper','Copper Pipes & Coils','أنابيب النحاس',4),
  ('pipes','pipes-hdpe','HDPE Pipes','أنابيب HDPE',5),
  ('pipes','pipes-pvc','PVC Pipes','أنابيب PVC',6),
  ('pipes','pipes-cpvc','CPVC Pipes','أنابيب CPVC',7),
  ('pipes','pipes-ppr','PPR Pipes','أنابيب PPR',8),
  ('pipes','pipes-cast-iron','Cast Iron Pipes','أنابيب الحديد الزهر',9),
  ('pipe-fittings','fittings-buttweld','Buttweld Fittings','وصلات اللحام الطرفي',1),
  ('pipe-fittings','fittings-stainless','Stainless Steel Fittings','وصلات ستانلس ستيل',2),
  ('pipe-fittings','fittings-carbon','Carbon Steel Fittings','وصلات الصلب الكربوني',3),
  ('pipe-fittings','fittings-duplex','Duplex Fittings','وصلات دوبلكس',4),
  ('pipe-fittings','fittings-elbows','Elbows (45° / 90°)','أكواع',5),
  ('pipe-fittings','fittings-tees','Tees (Equal / Reducing)','تيهات',6),
  ('pipe-fittings','fittings-reducers','Reducers (Concentric / Eccentric)','مخفضات',7),
  ('pipe-fittings','fittings-caps-couplings','Caps & Couplings','أغطية وجلب',8),
  ('forged-fittings','forged-threaded','Threaded Forged Fittings','وصلات مطروقة مسننة',1),
  ('forged-fittings','forged-socket-weld','Socket Weld Forged Fittings','وصلات مطروقة بلحام مقبس',2),
  ('forged-fittings','forged-class-2000','Class 2000','فئة 2000',3),
  ('forged-fittings','forged-class-3000','Class 3000','فئة 3000',4),
  ('forged-fittings','forged-class-6000','Class 6000','فئة 6000',5),
  ('forged-fittings','forged-class-9000','Class 9000','فئة 9000',6),
  ('copper-grooved-fittings','copper-fittings','Copper Fittings','وصلات نحاس',1),
  ('copper-grooved-fittings','grooved-fittings','Grooved Fittings','وصلات مخددة',2),
  ('plastic-fittings','fittings-hdpe','HDPE Fittings','وصلات HDPE',1),
  ('plastic-fittings','fittings-pvc','PVC Fittings','وصلات PVC',2),
  ('plastic-fittings','fittings-cpvc','CPVC Fittings','وصلات CPVC',3),
  ('plastic-fittings','fittings-ppr','PPR Fittings','وصلات PPR',4),
  ('flanges','flanges-blind','Blind Flanges','فلنجات عمياء',1),
  ('flanges','flanges-weld-neck','Weld Neck Flanges','فلنجات رقبة لحام',2),
  ('flanges','flanges-slip-on','Slip-On Flanges','فلنجات انزلاقية',3),
  ('flanges','flanges-socket-weld','Socket Weld Flanges','فلنجات مقبس لحام',4),
  ('flanges','flanges-threaded','Threaded Flanges','فلنجات مسننة',5),
  ('flanges','flanges-lap-joint','Lap Joint Flanges','فلنجات لاب جوينت',6),
  ('flanges','flanges-spectacle-blind','Spectacle Blind Flanges','فلنجات نظارة',7),
  ('flanges','flanges-orifice','Orifice Flanges','فلنجات فتحة القياس',8),
  ('valves','valves-gate','Gate Valves','صمامات بوابة',1),
  ('valves','valves-globe','Globe Valves','صمامات كروية (غلوب)',2),
  ('valves','valves-check','Check Valves','صمامات عدم رجوع',3),
  ('valves','valves-ball','Ball Valves','صمامات كرة',4),
  ('valves','valves-butterfly','Butterfly Valves','صمامات فراشة',5),
  ('valves','valves-instrument','Instrument Valves','صمامات أجهزة القياس',6),
  ('valves','valves-other','Other Industrial Valves','صمامات صناعية أخرى',7),
  ('fasteners','fasteners-bolts','Bolts & Screws','مسامير وبراغي',1),
  ('fasteners','fasteners-nuts','Nuts','صواميل',2),
  ('fasteners','fasteners-washers','Washers','وردات',3),
  ('fasteners','fasteners-studs','Studs & Threaded Rod','سيخ مسنن',4),
  ('fasteners','fasteners-anchors','Anchors','مراسي تثبيت',5),
  ('gaskets-gauges','gaskets','Gaskets','جوانات',1),
  ('gaskets-gauges','gauges','Gauges','مقاييس',2),
  ('other-products','other-clamps-adapters','Repair Clamps & Flange Adapters','مشابك إصلاح ووصلات فلنج',1),
  ('other-products','other-connectors','Flexible & Thread Connectors','وصلات مرنة',2),
  ('other-products','other-brass-tube','Brass Pipe & Tube Fittings','وصلات نحاس أصفر وأنابيب',3),
  ('other-products','other-safety-fire','Sprinklers, Air Vents & Safety','رشاشات وفتحات هواء وسلامة',4)
)
insert into categories (parent_id, slug, name_en, name_ar, sort_order)
select (select id from categories where slug = s.parent), s.slug, s.en, s.ar, s.ord from s
on conflict (slug) do nothing;

insert into attribute_defs (key, name_en, name_ar, is_filterable, sort_order) values
  ('size','Size','المقاس',true,10),
  ('material','Material','المادة',true,20),
  ('grade','Grade','الدرجة',true,30),
  ('schedule','Schedule','السماكة (Schedule)',true,40),
  ('pressure_class','Pressure Class','فئة الضغط',true,50),
  ('standard','Standard','المعيار',true,60),
  ('brand','Brand','العلامة التجارية',true,65),
  ('end_type','End Type','نوع الطرف',false,70),
  ('type','Type','النوع',false,80)
on conflict (key) do nothing;

insert into homepage_sections (type, title_en, title_ar, sort_order) values
  ('hero', 'Hero banners', 'البانر الرئيسي', 10),
  ('category_cards', 'Shop by category', 'تسوق حسب الفئة', 20),
  ('featured_products', 'Featured products', 'منتجات مميزة', 30),
  ('special_offers', 'Special offers', 'عروض خاصة', 40),
  ('new_arrivals', 'New arrivals', 'وصل حديثاً', 50),
  ('best_sellers', 'Best sellers', 'الأكثر مبيعاً', 60),
  ('brands', 'Brands we supply', 'العلامات التجارية', 70),
  ('why_us', 'Why KANZ CORNER', 'لماذا كنز كورنر', 80),
  ('rfq_cta', 'Request a quotation', 'اطلب عرض سعر', 90);

insert into menu_links (menu, label_en, label_ar, url, sort_order) values
  ('header','Products','المنتجات','/products',10),
  ('header','Request a Quote','اطلب عرض سعر','/rfq',20),
  ('header','About Us','من نحن','/about',30),
  ('header','Contact','اتصل بنا','/contact',40),
  ('footer_company','About Us','من نحن','/about',10),
  ('footer_company','Contact','اتصل بنا','/contact',20),
  ('footer_support','Request a Quote','اطلب عرض سعر','/rfq',10),
  ('footer_support','My Account','حسابي','/account',20),
  ('footer_legal','Privacy Policy','سياسة الخصوصية','/privacy',10),
  ('footer_legal','Terms & Conditions','الشروط والأحكام','/terms',20);
