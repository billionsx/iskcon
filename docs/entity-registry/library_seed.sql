-- library_seed.sql — воспроизводимый сид книжного слоя (применять после library_schema.sql).
-- works = книги-сущности реестра (единый id); демо-стихи показывают 5 слоёв и конкорданс.

INSERT OR IGNORE INTO works (id, kind, abbrev) SELECT id,'scripture',upper(id) FROM entities WHERE type='scripture';
UPDATE works SET author_id=(SELECT from_id FROM entity_relations r WHERE r.relation='author-of' AND r.to_id=works.id LIMIT 1) WHERE author_id IS NULL;
UPDATE works SET verse_scheme='canto.chapter.verse' WHERE id='sb';
UPDATE works SET verse_scheme='chapter.verse' WHERE id IN ('bg','cc','cb','cm');
UPDATE works SET verse_scheme='mantra' WHERE id IN ('iso','bs','noi');

INSERT OR IGNORE INTO editions (id,work_id,lang,title,translator,source,license,source_url) VALUES
 ('bg-sa','bg','sa','Bhagavad-gītā (санскрит)',NULL,'public','public-domain',NULL),
 ('bg-ru','bg','ru','Бхагавад-гита как она есть','А.Ч. Бхактиведанта Свами Прабхупада','vedabase.io','pending','https://vedabase.io/ru/library/bg/'),
 ('iso-sa','iso','sa','Īśopaniṣad (санскрит)',NULL,'public','public-domain',NULL),
 ('iso-ru','iso','ru','Шри Ишопанишад','А.Ч. Бхактиведанта Свами Прабхупада','vedabase.io','pending','https://vedabase.io/ru/library/iso/');

INSERT OR IGNORE INTO divisions (id,work_id,parent_id,level,number,title,ordinal) VALUES
 ('bg.1','bg',NULL,'chapter','1','{"ru":"Обзор армий на поле битвы Курукшетра"}',1);

INSERT OR IGNORE INTO verses (id,work_id,division_id,ref,ordinal,devanagari,translit,uvaca) VALUES
 ('bg.1.1','bg','bg.1','БГ 1.1',1,'धृतराष्ट्र उवाच । धर्मक्षेत्रे कुरुक्षेत्रे समवेता युयुत्सवः । मामकाः पाण्डवाश्चैव किमकुर्वत सञ्जय ॥','dharma-kṣetre kuru-kṣetre samavetā yuyutsavaḥ / māmakāḥ pāṇḍavāś caiva kim akurvata sañjaya','dhṛtarāṣṭra uvāca'),
 ('iso.0','iso',NULL,'Шри Ишопанишад, мангалачарана',0,'ॐ पूर्णमदः पूर्णमिदं पूर्णात्पूर्णमुदच्यते । पूर्णस्य पूर्णमादाय पूर्णमेवावशिष्यते ॥','oṁ pūrṇam adaḥ pūrṇam idaṁ pūrṇāt pūrṇam udacyate / pūrṇasya pūrṇam ādāya pūrṇam evāvaśiṣyate',NULL);
-- verse_tokens / lemmas / verse_texts: см. применённые INSERT в истории D1 (демо BG 1.1 + ISO);
-- entity_id у токенов dhṛtarāṣṭraḥ->dhritarashtra, sañjaya->sanjaya связывает слово с реестром.
