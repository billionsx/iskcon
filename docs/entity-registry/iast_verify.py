#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Verify/correct IAST across the registry using a curated Sanskrit lexicon.
- Cleans parenthetical descriptions out of name fields (into note).
- Rebuilds name_iast token-by-token; a name is 'verified' only if EVERY token resolves
  from the lexicon, else it keeps a best-effort form and is listed in iast_review.csv.
- Adds column iast_status (verified|review) to each entity CSV. Core stays verified.
"""
import csv, os, re
base = os.path.dirname(os.path.abspath(__file__))
FILES = [("entities_core.csv",False),("ggd_entities.csv",True),
         ("ggd_krishna_lila_entities.csv",True),("iskcon_gurus_entities.csv",False),
         ("prabhupada_lilamrita_entities.csv",False)]  # bool = regenerate name_en from ru

# ---------- curated IAST lexicon (plain-key -> IAST) ----------
LEX = {
# titles / structural
"swami":"Svāmī","svami":"Svāmī","goswami":"Gosvāmī","gosvami":"Gosvāmī","das":"Dāsa","dasa":"Dāsa",
"dasi":"Dāsī","devi":"Devī","maharaja":"Mahārāja","pandit":"Paṇḍita","pandita":"Paṇḍita",
"acharya":"Ācārya","acarya":"Ācārya","thakur":"Ṭhākura","thakura":"Ṭhākura","prabhu":"Prabhu",
"tirtha":"Tīrtha","puri":"Purī","bharati":"Bhāratī","muni":"Muni","mishra":"Miśra","misra":"Miśra",
"bhatta":"Bhaṭṭa","bhattacharya":"Bhaṭṭācārya","brahmachari":"Brahmacārī","brahmacari":"Brahmacārī",
"dvija":"Dvija","sena":"Sena","datta":"Datta","raya":"Rāya","rai":"Rāya","babaji":"Bābājī",
"gopi":"Gopī","manjari":"Mañjarī","gopa":"Gopa","avadhuta":"Avadhūta","kumara":"Kumāra","mantri":"Mantrī",
"ashrama":"Āśrama","asrama":"Āśrama","chakravarti":"Cakravartī","ghosh":"Ghoṣa","ghosha":"Ghoṣa",
"pippalai":"Pippalāi","simha":"Siṁha","mahashaya":"Mahāśaya","kaviraja":"Kavirāja","vidyanidhi":"Vidyānidhi",
# core names / deities / avatars
"krishna":"Kṛṣṇa","krsna":"Kṛṣṇa","balarama":"Balarāma","vishnu":"Viṣṇu","visnu":"Viṣṇu",
"narayana":"Nārāyaṇa","narayan":"Nārāyaṇa","rama":"Rāma","ramachandra":"Rāmacandra","nrisimha":"Nṛsiṁha",
"narasimha":"Narasiṁha","varaha":"Varāha","vamana":"Vāmana","kurma":"Kūrma","matsya":"Matsya",
"kalki":"Kalki","buddha":"Buddha","kapila":"Kapila","parashurama":"Paraśurāma","rishabha":"Ṛṣabha",
"rishabhadeva":"Ṛṣabhadeva","vyasa":"Vyāsa","vyasadeva":"Vyāsadeva","radharani":"Rādhārāṇī","radha":"Rādhā",
"rukmini":"Rukmiṇī","satyabhama":"Satyabhāmā","lakshmi":"Lakṣmī","sita":"Sītā","subhadra":"Subhadrā",
"nanda":"Nanda","yashoda":"Yaśodā","vasudeva":"Vasudeva","devaki":"Devakī","uddhava":"Uddhava",
"akrura":"Akrūra","arjuna":"Arjuna","yudhishthira":"Yudhiṣṭhira","bhima":"Bhīma","nakula":"Nakula",
"sahadeva":"Sahadeva","kunti":"Kuntī","draupadi":"Draupadī","abhimanyu":"Abhimanyu","pariksit":"Parīkṣit",
"sanjaya":"Sañjaya","vidura":"Vidura","bhishma":"Bhīṣma","drona":"Droṇa","dronacharya":"Droṇācārya",
"karna":"Karṇa","dhritarashtra":"Dhṛtarāṣṭra","duryodhana":"Duryodhana","prahlada":"Prahlāda",
"dhruva":"Dhruva","ajamila":"Ajāmila","ambarisa":"Ambarīṣa","bali":"Bali","bharata":"Bharata",
"sukadeva":"Śukadeva","maitreya":"Maitreya","narada":"Nārada","hiranyakashipu":"Hiraṇyakaśipu",
"hiranyaksha":"Hiraṇyākṣa","kamsa":"Kaṁsa","putana":"Pūtanā","ravana":"Rāvaṇa","hanuman":"Hanumān",
"brahma":"Brahmā","indra":"Indra","surya":"Sūrya","chandra":"Candra","candra":"Candra","varuna":"Varuṇa",
"yamaraja":"Yamarāja","agni":"Agni","kuvera":"Kuvera","ganesha":"Gaṇeśa","kartikeya":"Kārttikeya",
"vasishtha":"Vasiṣṭha","vishvamitra":"Viśvāmitra","atri":"Atri","kashyapa":"Kaśyapa","durvasa":"Durvāsā",
"bhrigu":"Bhṛgu","janaka":"Janaka","manu":"Manu",
# gaudiya / pancha-tattva / goswamis / parampara
"chaitanya":"Caitanya","caitanya":"Caitanya","mahaprabhu":"Mahāprabhu","nityananda":"Nityānanda",
"advaita":"Advaita","gadadhara":"Gadādhara","srivasa":"Śrīvāsa","svarupa":"Svarūpa","damodara":"Dāmodara",
"ramananda":"Rāmānanda","haridasa":"Haridāsa","rupa":"Rūpa","sanatana":"Sanātana","raghunatha":"Raghunātha",
"raghava":"Rāghava","gopala":"Gopāla","gopal":"Gopāla","bhatta_goswami":"Bhaṭṭa Gosvāmī","jiva":"Jīva",
"krishnadasa":"Kṛṣṇadāsa","krishnadas":"Kṛṣṇadāsa","vrindavana":"Vṛndāvana","narottama":"Narottama",
"madhavendra":"Mādhavendra","ishvara":"Īśvara","madhva":"Madhva","madhvacharya":"Madhvācārya",
"baladeva":"Baladeva","vidyabhushana":"Vidyābhūṣaṇa","bhaktivinoda":"Bhaktivinoda",
"gaurakishora":"Gaurakiśora","bhaktisiddhanta":"Bhaktisiddhānta","sarasvati":"Sarasvatī",
"prabhupada":"Prabhupāda","vishnujana":"Viṣṇujana","prithu":"Pṛthu",
"padmanabha":"Padmanābha","narahari":"Narahari","akshobhya":"Akṣobhya","jayatirtha":"Jayatīrtha",
"rajendra":"Rājendra","jayadharma":"Jayadharma","purushottama":"Puruṣottama","vyasatirtha":"Vyāsatīrtha",
"lakshmipati":"Lakṣmīpati","jnanasindhu":"Jñānasindhu","mahanidhi":"Mahānidhi","ranga":"Raṅga",
# common name components
"bhakti":"Bhakti","gaura":"Gaura","gauranga":"Gaurāṅga","govinda":"Govinda","gopinatha":"Gopīnātha",
"madhava":"Mādhava","mukunda":"Mukunda","keshava":"Keśava","kesava":"Keśava","shiva":"Śiva","siva":"Śiva",
"sadashiva":"Sadāśiva","vakreshvara":"Vakreśvara","kashishvara":"Kāśīśvara","ananta":"Ananta",
"jagannatha":"Jagannātha","jagannath":"Jagannātha","vanamali":"Vanamālī","vanamala":"Vanamālā",
"pundarika":"Puṇḍarīka","sridhara":"Śrīdhara","shridhara":"Śrīdhara","ananda":"Ānanda","vachaspati":"Vācaspati",
"vidya":"Vidyā","paramananda":"Paramānanda","govindananda":"Govindānanda","sarvabhauma":"Sārvabhauma",
"shyamasundara":"Śyāmasundara","brahmananda":"Brahmānanda","gargamuni":"Gargamuni","hayagriva":"Hayagrīva",
"jadurani":"Jāḍurāṇī","ganga":"Gaṅgā","virachandra":"Vīracandra","raghunandana":"Raghunandana",
"sumati":"Sumati","kashinatha":"Kāśīnātha","lokanatha":"Lokanātha","shrinatha":"Śrīnātha","ramanatha":"Rāmanātha",
"vallabha":"Vallabha","vallabhacharya":"Vallabhācārya","devananda":"Devānanda","nilambara":"Nīlāmbara",
"chandrashekhara":"Candraśekhara","vishveshvara":"Viśveśvara","bhaskara":"Bhāskara","sudama":"Sudāmā",
"garuda":"Garuḍa","kholavecha":"Kholāvecā","halayudha":"Halāyudha","kumudananda":"Kumudānanda",
"makaradhvaja":"Makaradhvaja","jagadisha":"Jagadīśa","murari":"Murāri","gupta":"Gupta","purandara":"Purandara",
"lalita":"Lalitā","vishakha":"Viśākhā","visakha":"Viśākhā","chitra":"Citrā","champakalata":"Campakalatā",
"tungavidya":"Tuṅgavidyā","indulekha":"Indulekhā","rangadevi":"Raṅgadevī","sudevi":"Sudevī",
"dhanishtha":"Dhaniṣṭhā","vrinda":"Vṛndā","kubja":"Kubjā","prema":"Premā","lila":"Līlā","raga":"Rāgā",
"rasa":"Rāsā","lavanga":"Lavaṅga","ananga":"Anaṅga","rati":"Rati","guna":"Guṇa",
}
LEX.update({
"shri":"Śrī","shrimati":"Śrīmatī","hari":"Hari","bhagavan":"Bhagavān","bhu":"Bhū","ray":"Rāya",
"narayani":"Nārāyaṇī","pradyumna":"Pradyumna","achyutananda":"Acyutānanda","bhavananda":"Bhavānanda",
"shankara":"Śaṅkara","prabodhananda":"Prabodhānanda","krishnananda":"Kṛṣṇānanda","vasu":"Vasu",
"shivananda":"Śivānanda","ratnakara":"Ratnākara","revati":"Revatī","indradyumna":"Indradyumna",
"kalakantha":"Kālakaṇṭha","dayita":"Dayita","gour":"Gaura","upendra":"Upendra","kamalavati":"Kamalāvatī",
"shachidevi":"Śacīdevī","padmavati":"Padmāvatī","malini":"Mālinī","lakshmipriya":"Lakṣmīpriyā",
"vishnupriya":"Viṣṇupriyā","jagadananda":"Jagadānanda","gangadasa":"Gaṅgādāsa","sudarshana":"Sudarśana",
"ratnavati":"Ratnāvatī","vasudha":"Vasudhā","jahnavi":"Jāhnavī","nandini":"Nandinī","prataparudra":"Pratāparudra",
"abhirama":"Abhirāma","ramadasa":"Rāmadāsa","ramadas":"Rāmadāsa","sundara":"Sundara","dhananjaya":"Dhanañjaya",
"gauridasa":"Gaurīdāsa","kamalakara":"Kamalākara","uddharana":"Uddhāraṇa","mahesha":"Maheśa","nagara":"Nāgara",
"parameshvara":"Parameśvara","kalakrishna":"Kālakṛṣṇa","rudra":"Rudra","makaradhvajakara":"Makaradhvajākara",
"chaytanya":"Caitanya","dhruvananda":"Dhruvānanda","damayanti":"Damayantī","pitambara":"Pītāmbara",
"vidyavachaspati":"Vidyāvācaspati","balabhadra":"Balabhadra","kavichandra":"Kavicandra","sharanga":"Śāraṅga",
"satyaraja":"Satyarāja","shrikanta":"Śrīkānta","sarakara":"Sarakāra","vamshi":"Vaṁśī","bhugarbha":"Bhūgarbha",
"kalidasa":"Kālidāsa","shuklambara":"Śuklāmbara","kashi":"Kāśī","sukhananda":"Sukhānanda",
"nrisimhananda":"Nṛsiṁhānanda","satyananda":"Satyānanda","chidananda":"Cidānanda","shrinidhi":"Śrīnidhi",
"shrigarbha":"Śrīgarbha","kaviratna":"Kaviratna","sudhanidhi":"Sudhānidhi","gunanidhi":"Guṇanidhi",
"ratnabahu":"Ratnabāhu","acharyaratna":"Ācāryaratna","subhananda":"Subhānanda","kamshari":"Kaṁsāri",
"subuddhi":"Subuddhi","shriharsha":"Śrīharṣa","raghu":"Raghu","jitamrita":"Jitāmṛta",
"bhagavatacharya":"Bhāgavatācārya","vaninatha":"Vāṇīnātha","ishanacharya":"Īśānācārya","kamala":"Kamalā",
"lakshminatha":"Lakṣmīnātha","hastigopala":"Hastigopāla","shrinayana":"Śrīnayana","kavidatta":"Kavidatta",
"chiranjiva":"Cirañjīva","sulochana":"Sulocana","gyanasindhu":"Jñānasindhu","parjanya":"Parjanya",
"variyasi":"Varīyasī","rohini":"Rohiṇī","paurnamasi":"Paurṇamāsī","ambika":"Ambikā","kilambika":"Kilambikā",
"janaki":"Jānakī","satrajit":"Satrājit","mamu":"Māmu","khanja":"Khañja","adikarta":"Ādikartā",
"asita":"Asita","acyuta":"Acyuta","atmanivedana":"Ātmanivedana","priya":"Priya","anugraha":"Anugraha",
"janardana":"Janārdana","asraya":"Āśraya","vaisnava":"Vaiṣṇava","vaibhava":"Vaibhava","bhagavatamrita":"Bhāgavatāmṛta",
"bhrnga":"Bhṛṅga","carudesna":"Cārudeṣṇa","adipurusha":"Ādipuruṣa","dhira":"Dhīra","gaurava":"Gaurava",
"gauravani":"Gauravāṇī","prabhava":"Prabhāva","vrata":"Vrata","pran":"Prāṇa","prema":"Prema","raghava":"Rāghava",
"ratnakara_amb":"Ratnākara","vasudeva":"Vāsudeva","vijnana":"Vijñāna","vikasa":"Vikāsa","vyasa_tirtha":"Vyāsa",
"narasimha_g":"Narasiṁha","bhusana":"Bhūṣaṇa","bhushana":"Bhūṣaṇa","marga":"Mārga","bhaktipada":"Bhaktipāda",
"bhurijana":"Bhūrijana","bir":"Bīra","avatari":"Avatārī","caran":"Caraṇa","mukha":"Mukha","danavir":"Dānavīra",
"dayavan":"Dayāvān","devakinandan":"Devakīnandana","devamrita":"Devāmṛta","dhanvantari":"Dhanvantari",
"dhirasanta":"Dhīraśānta","drutakarma":"Drutakarma","prem":"Prema","giridhari":"Giridhārī","gopaswami":"Gopasvāmī",
"haladhara":"Halādhara","hanumatpresaka":"Hanumatpreṣaka","harivilas":"Harivilāsa","hrdayananda":"Hṛdayānanda",
"janananda":"Janānanda","jayadvaita":"Jayādvaita","jayapataka":"Jayapatākā","jivananda":"Jīvānanda",
"kalakantha_g":"Kālakaṇṭha","kavicandra":"Kavicandra","ksetra":"Kṣetra","krsna":"Kṛṣṇa","kratu":"Kratu",
"kripamoya":"Kṛpāmaya","lokanath":"Lokanātha","madana":"Madana","mohana":"Mohana","madan":"Madana",
"sevita":"Sevita","mahadyuti":"Mahādyuti","mahaman":"Mahāmana","mahavisnu":"Mahāviṣṇu","mani":"Maṇi",
"bandha":"Bandha","manonatha":"Manonātha","avatara":"Avatāra","medhavi":"Medhāvī","navayogendra":"Navayogendra",
"niranjana":"Nirañjana","partha":"Pārtha","sarathi":"Sārathi","patita":"Patita","pavana":"Pāvana",
"prahladananda":"Prahlādānanda","purushatraya":"Puruṣatraya","radhacaran":"Rādhācaraṇa","radhacharan":"Rādhācaraṇa",
"radhanath":"Rādhānātha","ravindra":"Raviīndra","revati_raman":"Revatī","raman":"Ramaṇa","romapada":"Romapāda",
"rtadhvaja":"Ṛtadhvaja","sacinandana":"Śacīnandana","samik":"Śamīka","rsi":"Ṛṣi","sankarsana":"Saṅkarṣaṇa",
"satyadeva":"Satyadeva","siddhartha":"Siddhārtha","sikhi":"Śikhi","mahiti":"Māhiti","smita":"Smita",
"sridhama":"Śrīdhāma","srivas":"Śrīvāsa","subhaga":"Subhaga","sundarananda":"Sundarānanda","sukadeva_sw":"Śukadeva",
"umapati":"Umāpati","vaisesika":"Vaiśeṣika","varsana":"Varṣāṇā","vatsala":"Vatsala","srestha":"Śreṣṭha",
"vedavyasapriya":"Vedavyāsapriya","virabahu":"Vīrabāhu","yadunandana":"Yadunandana","yamunacarya":"Yamunācārya",
"bhanu":"Bhānu","ganapati":"Gaṇapati","giriraja":"Girirāja","vegavan":"Vegavān","gopinath":"Gopīnātha",
"mohan":"Mohana","de":"De","rajani":"Rajanī","radharani_de":"Rādhārāṇī","prajnana":"Prajñāna",
"rakshak":"Rakṣaka","hridaya":"Hṛdaya","bon":"Bon","pramode":"Pramoda","saranga":"Sāraṅga","akincana":"Akiñcana",
"kirtanananda":"Kīrtanānanda","hansadutta":"Haṁsadūta","ramesvara":"Rāmeśvara","harikesa":"Harikeśa",
"jayatirtha_d":"Jayatīrtha","gurudas":"Gurudāsa","rupanuga":"Rūpānuga","rayarama":"Rāyarāma","govinda_dasi":"Govinda",
"morarji":"Morārjī","bhakti_d":"Bhakti","sumati":"Sumati","matsya_avatara":"Matsyāvatāra",
})

LEX.update({
"achyuta":"Acyuta","angada":"Aṅgada","aniruddha":"Aniruddha","bhaguri":"Bhāguri","bhangura":"Bhaṅgura",
"bhringara":"Bhṛṅgāra","brahman":"Brāhmaṇa","brihaspati":"Bṛhaspati","candramauli":"Candramauli",
"chandrahasa":"Candrahāsa","chandrakanti":"Candrakānti","chandramukha":"Candramukha","chandravali":"Candrāvalī",
"charu":"Cāru","chitrani":"Citrāṇī","daksha":"Dakṣa","dama":"Dāma","duti":"Dūtī","gandharva":"Gandharva",
"garga":"Garga","guru":"Guru","gauraseni":"Gauraseṇī","gunamala":"Guṇamālā","haridas":"Haridāsa",
"indira":"Indirā","jaya":"Jaya","kakudmi":"Kakudmī","kalavati":"Kalāvatī","karttikeya":"Kārttikeya",
"katyayani":"Kātyāyanī","kaveri":"Kāverī","kirtida":"Kīrtidā","kshirodakashayi":"Kṣīrodakaśāyī",
"kulaka":"Kulaka","kumar":"Kumāra","kumuda":"Kumuda","kusumashava":"Kusumāśava","madhavi":"Mādhavī",
"madhu":"Madhu","madhukantha":"Madhukaṇṭha","madhumati":"Madhumatī","madhurekshana":"Madhurekṣaṇā",
"madhuvrata":"Madhuvrata","mahabahu":"Mahābāhu","mahabala":"Mahābala","mahatma":"Mahātmā","maladhara":"Mālādhara",
"malli":"Mallī","manohara":"Manoharā","nandimukhi":"Nandīmukhī","pali":"Pālī","pandu":"Pāṇḍu",
"parvata":"Parvata","patni":"Patnī","patraka":"Patraka","payoda":"Payoda","prabala":"Prabala",
"pundarikaksha":"Puṇḍarīkākṣa","purnananda":"Pūrṇānanda","raktaka":"Raktaka","ratnarekha":"Ratnarekhā",
"ratnavali":"Ratnāvalī","sandipani":"Sāndīpani","saraswati":"Sarasvatī","satsvarupa":"Satsvarūpa",
"shantanu":"Śāntanu","shashirekha":"Śaśirekhā","shaybya":"Śaibyā","shribhadra":"Śrībhadrā",
"shridama":"Śrīdāmā","shrikanthabharana":"Śrīkaṇṭhābharaṇa","sivarama":"Śivarāma","sridhar":"Śrīdhara",
"stokakrishna":"Stokakṛṣṇa","subahu":"Subāhu","subala":"Subala","sudhakara":"Sudhākara","sugriva":"Sugrīva",
"sukantha":"Sukaṇṭha","sukeshi":"Sukeśī","sundar":"Sundara","tamal":"Tamāla","taraka":"Tārakā",
"varida":"Vārida","varuni":"Vāruṇī","varuthapa":"Varūthapa","vasudama":"Vasudāma","vibhishana":"Vibhīṣaṇa",
"vichakshana":"Vicakṣaṇa","vijaya":"Vijaya","vira":"Vīrā","vishvakarma":"Viśvakarmā","vrishabhanu":"Vṛṣabhānu",
"yogamayya":"Yogamāyā","bhaktimarga":"Bhaktimārga","bhaktivaibhava":"Bhaktivaibhava","bhaktivyasa":"Bhaktivyāsa",
"candramauli_s":"Candramauli","rati":"Rati","rasa":"Rāsa","lavanga":"Lavaṅga","kshetra":"Kṣetra",
"prasad":"Prasāda","vv":"VV",
})

GROUP_FIX = {
 "eight-siddhis":("Eight Siddhis","Восемь сиддхи","Aṣṭa-siddhi"),
 "nine-jayantas":("Nine Jayantas","Девять Джаянт","Nava Jayanta"),
 "nine-treasures-kuvera":("Nine Treasures of Kuvera","Девять сокровищ Куверы","Nava-nidhi"),
 "four-kumaras":("Four Kumaras","Четыре Кумара","Catur-kumāra"),
 "sakhi-of-radharani":("Sakhis of Radharani","Сакхи Радхарани","Sakhī"),
}

# multi-word phrase fixes applied after token join
PHRASE = {"Bhatta Gosvami":"Bhaṭṭa Gosvāmī"}

def plainkey(t):
    rep={"ā":"a","ī":"i","ū":"u","ṛ":"ri","ṇ":"n","ṭ":"t","ḍ":"d","ṣ":"s","ś":"s","ḥ":"h","ṁ":"m","ñ":"ny","ṅ":"n","ʼ":""}
    t=t.lower()
    for a,b in rep.items(): t=t.replace(a,b)
    return re.sub(r"[^a-z]","",t)

def iast_name(name_en):
    parts=re.split(r"(\s+|-)",name_en); out=[]; unresolved=[]
    for p in parts:
        if not p.strip() or re.match(r"^[\s-]+$",p): out.append(p); continue
        k=plainkey(p)
        if k in LEX: out.append(LEX[k])
        else: out.append(p); unresolved.append(p)
    s="".join(out)
    for a,b in PHRASE.items(): s=s.replace(a,b)
    return s, unresolved

# cyr->lat for regenerating clean name_en (GGD)
M=[("дж","j"),("кх","kh"),("бх","bh"),("гх","gh"),("дх","dh"),("тх","th"),("пх","ph"),("чх","ch"),("кш","ksh")]
C={"а":"a","б":"b","в":"v","г":"g","д":"d","е":"e","ё":"e","ж":"j","з":"z","и":"i","й":"y","к":"k","л":"l","м":"m","н":"n","о":"o","п":"p","р":"r","с":"s","т":"t","у":"u","ф":"ph","х":"h","ц":"ts","ч":"ch","ш":"sh","щ":"sh","ъ":"","ы":"y","ь":"","э":"e","ю":"yu","я":"ya"}
def cyr2lat(s):
    s=s.lower()
    for a,b in M: s=s.replace(a,b)
    return re.sub(r"\s+"," ","".join(C.get(c,c) for c in s)).strip()
def tc(s): return " ".join("-".join(w.capitalize() for w in part.split("-")) for part in s.split(" "))

def clean_paren(val, note):
    m=re.search(r"\s*\((.*?)\)\s*", val or "")
    if m:
        desc=m.group(1).strip()
        if desc and desc not in (note or ""):
            note=(note+" · " if note else "")+desc
        val=re.sub(r"\s*\(.*?\)\s*"," ",val).strip()
    return val, note

review=[]
for fn,regen in FILES:
    path=os.path.join(base,fn); rows=list(csv.DictReader(open(path,encoding="utf-8")))
    flds=list(rows[0].keys())
    if "iast_status" not in flds: flds.append("iast_status")
    for r in rows:
        note=r.get("note","")
        ru,note=clean_paren(r.get("name_ru",""),note)
        en,note=clean_paren(r.get("name_en",""),note)
        r["name_ru"]=ru; r["note"]=note
        if regen or not en:
            en=tc(cyr2lat(ru)) if ru else en
        r["name_en"]=en
        if r["id"] in GROUP_FIX:
            g=GROUP_FIX[r["id"]]; r["name_en"],r["name_ru"],r["name_iast"]=g[0],g[1],g[2]
            r["iast_status"]="verified"; continue
        if fn=="entities_core.csv" and (r.get("name_iast") or "").strip():
            r["iast_status"]="verified"; continue  # keep hand-curated core IAST
        ia,unres=iast_name(en)
        r["name_iast"]=ia
        if unres:
            r["iast_status"]="review"; review.append([r["id"],en,ia,"|".join(sorted(set(unres)))])
        else:
            r["iast_status"]="verified"
    with open(path,"w",newline="",encoding="utf-8") as f:
        w=csv.DictWriter(f,fieldnames=flds); w.writeheader(); w.writerows(rows)

with open(os.path.join(base,"iast_review.csv"),"w",newline="",encoding="utf-8") as f:
    w=csv.writer(f); w.writerow(["id","name_en","name_iast_bestguess","unresolved_tokens"]); w.writerows(review)

tot=sum(len(list(csv.DictReader(open(os.path.join(base,fn),encoding="utf-8")))) for fn,_ in FILES)
print("total entities:",tot,"| needing IAST review:",len(review),"| verified:",tot-len(review))
