-- Homepage redesign: new section types the admin can enable, disable and reorder like the existing ones.
alter table homepage_sections drop constraint if exists homepage_sections_type_check;
alter table homepage_sections add constraint homepage_sections_type_check check (type in (
  'hero','category_cards','featured_products','new_arrivals','best_sellers','special_offers','brands','announcement','why_us','rfq_cta','custom_html',
  'quick_filters','industries','certifications','rfq_steps','recently_viewed','promo_banners'));

-- Add the new blocks once, in a sensible position (existing order and texts are left untouched).
insert into homepage_sections (type, title_en, title_ar, sort_order, is_enabled)
select v.type, v.title_en, v.title_ar, v.sort_order, true
from (values
  ('promo_banners',   null::text, null::text, 12),
  ('quick_filters',   'Browse by material & standard', 'تصفح حسب المادة والمواصفة', 15),
  ('industries',      'Products for your sector', 'منتجات لقطاعك', 25),
  ('certifications',  'Certificates & approvals', 'الشهادات والاعتمادات', 75),
  ('rfq_steps',       'Request a quotation in 3 steps', 'اطلب عرض سعر في 3 خطوات', 35),
  ('recently_viewed', 'Recently viewed', 'شوهدت مؤخراً', 87)
) as v(type, title_en, title_ar, sort_order)
where not exists (select 1 from homepage_sections h where h.type = v.type);
