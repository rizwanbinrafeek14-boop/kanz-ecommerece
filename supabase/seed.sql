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

-- ───────── Category buying guides (same statements as migration 0012; on a brand-new database the categories only exist after this seed) ─────────
update categories set buying_guide_en = $kb$Choose a pipe by service first: fluid, operating temperature and pressure, and any corrosion risk. Carbon steel suits many general and utility services; stainless and duplex grades are selected where corrosion resistance matters. Confirm the material specification (for example ASTM A106, A53 or API 5L), whether the pipe is seamless or welded, the nominal size, the schedule or wall thickness, and the end finish (plain or bevelled) before you order. Ask for the mill test certificate if your project requires material traceability.$kb$, buying_guide_ar = $kb$اختر الأنبوب بحسب ظروف التشغيل أولاً: نوع المائع ودرجة الحرارة والضغط ومخاطر التآكل. يناسب الصلب الكربوني كثيراً من الخدمات العامة، بينما تُختار أنواع الستانلس ستيل والدوبلكس عندما تكون مقاومة التآكل مهمة. قبل الطلب، حدد مواصفة المادة (مثل ASTM A106 أو A53 أو API 5L)، وهل الأنبوب بدون لحام أم ملحوم، والمقاس الاسمي، والسماكة أو الـ Schedule، ونوع الطرف (عادي أو مشطوف). اطلب شهادة اختبار المصنع (MTC) إذا كان مشروعك يتطلب تتبّع المواد.$kb$ where slug = 'pipes' and buying_guide_en is null and buying_guide_ar is null;
update categories set buying_guide_en = $kb$Match a fitting to the pipe it joins: the same nominal size, material grade and schedule or wall thickness. Butt-weld fittings (elbows, tees, reducers, caps) are welded into the line and are common for permanent, higher-pressure piping; check the standard (such as ASME B16.9), the radius of elbows (long or short) and the end bevel. Tell us the angle, size and any reduction (for example 6 in x 4 in) so we can quote the correct item.$kb$, buying_guide_ar = $kb$يجب أن تطابق الوصلة الأنبوب الذي تربطه من حيث المقاس الاسمي ودرجة المادة والسماكة أو الـ Schedule. تُلحم وصلات اللحام الطرفي (الأكواع والتيهات والمخفضات والأغطية) داخل الخط وهي شائعة في التمديدات الدائمة ذات الضغوط الأعلى؛ تحقق من المواصفة (مثل ASME B16.9) ونصف قطر الكوع (طويل أو قصير) ونوع الشطف. أخبرنا بالزاوية والمقاس وأي تخفيض (مثل 6 بوصة × 4 بوصة) لنقدّم لك السعر للصنف الصحيح.$kb$ where slug = 'pipe-fittings' and buying_guide_en is null and buying_guide_ar is null;
update categories set buying_guide_en = $kb$Forged fittings are normally used on smaller-bore, higher-pressure lines. Decide the connection first: threaded (NPT) or socket-weld. Then confirm the pressure class, which is commonly 2000, 3000, 6000 or 9000 depending on the connection, and the material grade and standard (for example ASME B16.11). Pressure class must suit the design pressure of the line, so please share the service conditions and the size when you request a quotation.$kb$, buying_guide_ar = $kb$تُستخدم الوصلات المطروقة عادةً في الخطوط الصغيرة القطر ذات الضغوط الأعلى. حدد نوع التوصيل أولاً: مسنّن (NPT) أو لحام مقبس (Socket Weld). ثم أكّد فئة الضغط (تشيع الفئات 2000 و3000 و6000 و9000 بحسب نوع التوصيل) ودرجة المادة والمواصفة (مثل ASME B16.11). يجب أن تناسب فئة الضغط ضغط التصميم للخط، لذا يرجى إرسال ظروف التشغيل والمقاس عند طلب عرض السعر.$kb$ where slug = 'forged-fittings' and buying_guide_en is null and buying_guide_ar is null;
update categories set buying_guide_en = $kb$Grooved couplings and fittings join pipe ends that have been cut or rolled with a groove, so they can be assembled and dismantled without welding. Confirm the pipe outside diameter and material, the pressure rating required by your system, the coupling type (rigid or flexible) and the gasket material suited to the fluid and temperature. Where you need documentation, ask us which test or approval documents we hold for the exact product and size.$kb$, buying_guide_ar = $kb$تربط الوصلات المخددة نهايات الأنابيب التي تم عمل أخدود لها بالقطع أو بالدرفلة، ويمكن تركيبها وفكّها دون لحام. أكّد القطر الخارجي للأنبوب ومادته، وتصنيف الضغط المطلوب لنظامك، ونوع الوصلة (ثابتة أو مرنة)، ومادة الجوان المناسبة للمائع ودرجة الحرارة. وإذا كنت تحتاج إلى مستندات، فاسألنا عن شهادات الاختبار أو الاعتمادات المتوفرة لدينا للصنف والمقاس المحدد.$kb$ where slug = 'copper-grooved-fittings' and buying_guide_en is null and buying_guide_ar is null;
update categories set buying_guide_en = $kb$Select plastic piping by material and service: HDPE for buried and flexible lines, PVC and CPVC for water and chemical services within their temperature limits, and PPR for hot and cold water systems. Check the pressure rating (PN), the size, the jointing method (fusion, solvent cement or threaded) and the standard the project requires. Temperature lowers the allowable pressure of plastics, so share your operating conditions when you ask for a quotation.$kb$, buying_guide_ar = $kb$اختر أنظمة الأنابيب البلاستيكية بحسب المادة والخدمة: HDPE للخطوط المدفونة والمرنة، وPVC وCPVC لخدمات المياه والمواد الكيميائية ضمن حدود الحرارة المسموحة، وPPR لشبكات المياه الساخنة والباردة. تحقق من تصنيف الضغط (PN) والمقاس وطريقة الوصل (لحام حراري أو لصق بالمذيب أو مسنّن) والمواصفة التي يطلبها المشروع. ترتفع الحرارة فتنخفض قدرة التحمّل للضغط في البلاستيك، لذا أرسل لنا ظروف التشغيل عند طلب السعر.$kb$ where slug = 'plastic-fittings' and buying_guide_en is null and buying_guide_ar is null;
update categories set buying_guide_en = $kb$A flange must match its mating flange in standard, pressure class, size and facing. Confirm the standard (such as ASME B16.5), the class (150, 300, 600 and so on), the type (weld neck, slip-on, socket weld, threaded, blind, lap joint), the face (raised or flat) and the material. Weld-neck flanges are usually chosen for demanding services; slip-on flanges are easier to fit on lower-pressure lines. Remember to order the matching gaskets and bolting.$kb$, buying_guide_ar = $kb$يجب أن يطابق الفلنج الفلنج المقابل له في المواصفة وفئة الضغط والمقاس ونوع الوجه. أكّد المواصفة (مثل ASME B16.5) والفئة (150 أو 300 أو 600 وغيرها) والنوع (رقبة لحام أو انزلاقي أو لحام مقبس أو مسنّن أو أعمى أو لاب جوينت) والوجه (بارز أو مسطح) والمادة. تُختار فلنجات رقبة اللحام عادةً للخدمات الصعبة، أما الانزلاقية فتركيبها أسهل على الخطوط الأقل ضغطاً. ولا تنسَ طلب الجوانات والمسامير المناسبة.$kb$ where slug = 'flanges' and buying_guide_en is null and buying_guide_ar is null;
update categories set buying_guide_en = $kb$Choose the valve by its job: gate and ball valves for isolation, globe valves for throttling, check valves to stop reverse flow, and butterfly valves for larger lines. Confirm the size, pressure class, end connection (flanged, threaded, welded or wafer), the body and trim material for the fluid, and the seat or seal material. Tell us the service, pressure and temperature so we can quote a suitable valve.$kb$, buying_guide_ar = $kb$اختر الصمام بحسب وظيفته: صمامات البوابة والكرة للعزل، وصمامات الكروي (غلوب) للتحكم في التدفق، وصمامات عدم الرجوع لمنع التدفق العكسي، وصمامات الفراشة للخطوط الكبيرة. أكّد المقاس وفئة الضغط ونوع التوصيل (فلنج أو مسنّن أو لحام أو ويفر) ومادة الجسم والأجزاء الداخلية المناسبة للمائع ومادة المقعد أو الإحكام. أخبرنا بنوع الخدمة والضغط ودرجة الحرارة لنقدّم لك صماماً مناسباً.$kb$ where slug = 'valves' and buying_guide_en is null and buying_guide_ar is null;
update categories set buying_guide_en = $kb$Bolting must suit the flange and the service. Check the thread size and length, the material grade (carbon steel, alloy or stainless), the coating if corrosion protection is needed, and the matching nuts and washers. Stud bolts are normally supplied with two nuts. For flanged joints, confirm the number and size of bolts for the flange class, and order spare gaskets together with the bolting.$kb$, buying_guide_ar = $kb$يجب أن تناسب المسامير الفلنج والخدمة. تحقق من مقاس السن والطول ودرجة المادة (صلب كربوني أو سبائك أو ستانلس ستيل) والطلاء إذا لزمت الحماية من التآكل، مع الصواميل والوردات المناسبة. تُورَّد المسامير المسننة (Stud) عادةً مع صامولتين. وللوصلات الفلنجية، أكّد عدد المسامير ومقاسها بحسب فئة الفلنج، واطلب الجوانات مع المسامير.$kb$ where slug = 'fasteners' and buying_guide_en is null and buying_guide_ar is null;
update categories set buying_guide_en = $kb$A gasket must suit the flange face, the pressure class and the fluid: spiral-wound and ring-type joints are used in higher-pressure services, while non-metallic sheet gaskets suit lower pressures. For pressure gauges, confirm the dial size, pressure range (the working pressure should sit within the middle of the scale), connection thread and position, and whether a liquid-filled case is needed for vibration.$kb$, buying_guide_ar = $kb$يجب أن يناسب الجوان وجه الفلنج وفئة الضغط والمائع: تُستخدم الجوانات الحلزونية وجوانات الحلقة (RTJ) في الخدمات ذات الضغط الأعلى، بينما تناسب الجوانات غير المعدنية الضغوط الأقل. وبالنسبة لمقاييس الضغط، أكّد قطر الميناء ومدى الضغط (ويفضّل أن يقع ضغط التشغيل في منتصف المقياس) ومقاس سن التوصيل واتجاهه، وهل تحتاج إلى علبة مملوءة بسائل للحد من أثر الاهتزاز.$kb$ where slug = 'gaskets-gauges' and buying_guide_en is null and buying_guide_ar is null;
update categories c set buying_guide_en = p.buying_guide_en, buying_guide_ar = p.buying_guide_ar from categories p where c.slug = 'grooved-fittings' and p.slug = 'copper-grooved-fittings' and c.buying_guide_en is null;
