-- SEO: per-page social/noindex controls, category buying guides, slug-change redirects, extra measurement events.

alter table products
  add column if not exists og_title_en text, add column if not exists og_title_ar text,
  add column if not exists og_desc_en text, add column if not exists og_desc_ar text,
  add column if not exists og_image_path text,                      -- bucket product-images (or banners); null = first product image
  add column if not exists seo_noindex boolean not null default false;
alter table categories
  add column if not exists seo_noindex boolean not null default false,
  add column if not exists buying_guide_en text, add column if not exists buying_guide_ar text;

-- ───────── Old URL -> new URL (created automatically whenever a product or category slug changes) ─────────
create table if not exists slug_redirects (
  entity text not null check (entity in ('product', 'category')),
  old_slug text not null,
  new_slug text not null,
  created_at timestamptz not null default now(),
  primary key (entity, old_slug)
);
alter table slug_redirects enable row level security;
drop policy if exists "slug_redirects public read" on slug_redirects;
create policy "slug_redirects public read" on slug_redirects for select using (true);
drop policy if exists "slug_redirects admin write" on slug_redirects;
create policy "slug_redirects admin write" on slug_redirects for all using (is_admin()) with check (is_admin());
grant select on slug_redirects to anon;
grant select, insert, update, delete on slug_redirects to authenticated;

create or replace function record_slug_change() returns trigger language plpgsql security definer set search_path = public as $$
declare ent text := tg_argv[0];
begin
  if new.slug is distinct from old.slug then
    delete from slug_redirects where entity = ent and old_slug = new.slug;                       -- the new address is live, never a redirect source
    update slug_redirects set new_slug = new.slug where entity = ent and new_slug = old.slug;    -- keep chains one hop long
    insert into slug_redirects (entity, old_slug, new_slug) values (ent, old.slug, new.slug)
      on conflict (entity, old_slug) do update set new_slug = excluded.new_slug;
  end if;
  return new;
end $$;
drop trigger if exists products_slug_redirect on products;
create trigger products_slug_redirect after update of slug on products for each row execute function record_slug_change('product');
drop trigger if exists categories_slug_redirect on categories;
create trigger categories_slug_redirect after update of slug on categories for each row execute function record_slug_change('category');

-- ───────── More measurable actions (still anonymous, first-party) ─────────
alter table analytics_events drop constraint if exists analytics_events_event_check;
alter table analytics_events add constraint analytics_events_event_check
  check (event in ('page_view','product_view','search','banner_impression','banner_click','add_to_cart','rfq_submit','whatsapp_click','phone_click','datasheet_download'));

create or replace function track_event(p_event text, p_session text, p_path text default null, p_product uuid default null, p_banner uuid default null, p_query text default null, p_lang text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_event not in ('page_view','product_view','search','banner_impression','banner_click','add_to_cart','whatsapp_click','phone_click','datasheet_download') then return; end if;   -- rfq_submit is recorded by submit_rfq itself
  if p_session is null or length(p_session) > 64 then return; end if;
  insert into analytics_events (event, session_id, path, product_id, banner_id, query, lang)
  values (p_event, p_session, left(p_path, 300), p_product, p_banner, left(p_query, 200), left(p_lang, 5));
  if p_event = 'product_view' and p_product is not null then update products set view_count = view_count + 1 where id = p_product; end if;
  if p_event = 'banner_impression' and p_banner is not null then update banners set impressions = impressions + 1 where id = p_banner; end if;
  if p_event = 'banner_click' and p_banner is not null then update banners set clicks = clicks + 1 where id = p_banner; end if;
end $$;

-- Traffic report: add phone clicks and datasheet downloads
drop function if exists admin_traffic(date, date);
create or replace function admin_traffic(p_from date, p_to date)
returns table (day date, visitors bigint, page_views bigint, product_views bigint, searches bigint, whatsapp_clicks bigint, rfq_submits bigint, phone_clicks bigint, datasheet_downloads bigint)
language sql stable security definer set search_path = public as $$
  select d::date,
    count(distinct e.session_id) filter (where e.event is not null), count(*) filter (where e.event = 'page_view'), count(*) filter (where e.event = 'product_view'),
    count(*) filter (where e.event = 'search'), count(*) filter (where e.event = 'whatsapp_click'), count(*) filter (where e.event = 'rfq_submit'),
    count(*) filter (where e.event = 'phone_click'), count(*) filter (where e.event = 'datasheet_download')
  from generate_series(p_from, p_to, interval '1 day') d
  left join analytics_events e on (e.created_at at time zone 'Asia/Riyadh')::date = d::date
  where is_staff() group by d order by d
$$;
grant execute on function admin_traffic(date, date) to authenticated;

-- ───────── Buying guides (general selection advice; only fills categories that have none yet) ─────────
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
