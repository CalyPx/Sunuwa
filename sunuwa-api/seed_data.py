"""
Seed Script — generates 50 realistic complaints with embeddings and inserts into Supabase.
Run: python seed_data.py
Takes ~3 minutes (embedding each complaint locally).

DO NOT run more than once without clearing the complaints table first.
"""

import os
import random
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

# Realistic complaints — (text, category, severity, summary_ne)
COMPLAINTS = [
    # Education (15)
    ("NEB Grade 12 result chado aayo tara quality kharab cha. Retake fee Rs 1000 dherai mahango cha hamiharuko lagi.", "Education", 8,
     "NEB कक्षा १२ को नतिजामा गुणस्तर कमजोर, पुनः परीक्षा शुल्क १,०००रु गरिबका लागि मँहगो"),
    ("Hamro school ma teacher nai hudaina, harek hapta 3-4 din school banda huncha. Bachhaharu ko padhai kharab bhaisakyo.", "Education", 7,
     "विद्यालयमा शिक्षक नै आउँदैनन्, हरेक हप्ता ३-४ दिन बन्द, बालबालिकाको पढाइ बर्बाद भइसक्यो"),
    ("सरकारी विद्यालयमा पाठ्यपुस्तक समयमा आएन। बर्ष आधा सकियो पनि किताब छैन।", "Education", 7,
     "सरकारी विद्यालयमा वर्ष आधा सकिए पनि पाठ्यपुस्तक आएन"),
    ("NEB ko practical exam ma irregularity dekhiyo. External examiner aae nai bhएन, school ko teacher le nai mark diye.", "Education", 9,
     "NEB प्रयोगात्मक परीक्षामा अनियमितता, बाह्य परीक्षक नआई विद्यालयकै शिक्षकले अंक दिए"),
    ("Scholarship ko form bharna gayo, office le bhanyo server down cha, 3 hapta bhai sakyo yahi same answer.", "Education", 6,
     "छात्रवृत्ति फाराम भर्न गयो, ३ हप्तादेखि 'सर्भर डाउन' भनेर फिर्ता पठाइन्छ"),
    ("Our village school has only one teacher for 5 classes. Children are being forced to sit idle most of the time.", "Education", 8,
     "हाम्रो गाउँको विद्यालयमा ५ कक्षाका लागि एकजना मात्र शिक्षक, बालबालिका अधिकांश समय खाली बस्छन्"),
    ("Campus ma exam form fill garda extra charge liniyo Rs 2000. Receipt diyena. Clearly corruption cha.", "Education", 8,
     "क्याम्पसमा परीक्षा फाराम भर्दा थप रु.२,००० लिइयो, रसिद दिइएन, भ्रष्टाचार स्पष्ट छ"),
    ("सामुदायिक विद्यालयको भवन जीर्ण छ। पानी पर्दा छाना चुहिन्छ। बालबालिका पढ्न सक्दैनन्।", "Education", 7,
     "सामुदायिक विद्यालयको जीर्ण भवनबाट पानी पर्दा छाना चुहिन्छ, बालबालिका पढ्न सक्दैनन्"),
    ("Grade 11 ma admit huna gayera registration garauna bhanyo, 6 mahina bhai sakyo kei response nai bhayena.", "Education", 6,
     "कक्षा ११ दर्ताका लागि ६ महिनादेखि कुनै प्रतिक्रिया छैन"),
    ("SLC result ma mero number galthi thiyo, correction garna gayo 2 mahina bhai sakyo kei bhayena.", "Education", 7,
     "SLC नतिजामा अंक गल्ती छ, सच्याउन गएकोमा २ महिना भयो, समाधान भएन"),
    ("Government school teachers absent rahanchan tara private school private tuition padhaichan. Action lina paryo.", "Education", 8,
     "सरकारी विद्यालयका शिक्षक अनुपस्थित रहन्छन् र निजी ट्युसन पढाउँछन्, कारबाही हुनुपर्छ"),
    ("हाम्रो वडामा माध्यमिक विद्यालय छैन। बालबालिकाले ५ किलोमिटर हिँडेर जानु पर्छ।", "Education", 6,
     "हाम्रो वडामा माध्यमिक विद्यालय छैन, बालबालिकाले ५ किमि हिँड्नुपर्छ"),
    ("University library 5 PM ma banda huncha, exam season ma bhi. Student haru kahan padhne?", "Education", 5,
     "विश्वविद्यालय पुस्तकालय साँझ ५ बजे बन्द हुन्छ, परीक्षाको समयमा पनि"),
    ("Education ministry ko website 2 mahina dekhi down cha. Online form bhar na sakiyena.", "Education", 5,
     "शिक्षा मन्त्रालयको वेबसाइट २ महिनादेखि बन्द, अनलाइन फाराम भर्न असम्भव"),
    ("Hostel fee Rs 80000 tira gayo tara facilities zero cha. Toothbrush samma dena parcha bhancha.", "Education", 6,
     "छात्रावास शुल्क ८०,०००रु भयो तर सुविधा शून्य छ"),

    # Infrastructure (12)
    ("Hamro ward ko mula bato 8 mahina dekhi phatieko cha. Koi milna aayena. Motor cycle le nai garo huncha.", "Infrastructure", 7,
     "हाम्रो वडाको मुख्य सडक ८ महिनादेखि भाँचिएको छ, मर्मत गर्न कोही आएन"),
    ("सडकमा ठूलो खाडल छ। गत हप्ता एउटा मोटरसाइकल दुर्घटना भयो। वडा कार्यालयले सुनेन।", "Infrastructure", 9,
     "सडकको ठूलो खाडलले गत हप्ता मोटरसाइकल दुर्घटना भयो, वडा कार्यालयले सुनेन"),
    ("The bridge in our village has developed cracks. Engineers said it needs repair 6 months ago but nothing happened.", "Infrastructure", 9,
     "हाम्रो गाउँको पुलमा दरार परेको छ, इन्जिनियरले ६ महिना पहिले मर्मत आवश्यक भनेका थिए"),
    ("Kathmandu ma pothole everywhere cha. Monsoon ma kei bhandaina, post monsoon ma bhi kei hudaina.", "Infrastructure", 6,
     "काठमाडौंमा हरतर्फ खाडल छ, मनसुन र सुक्खायाम दुवैमा समाधान छैन"),
    ("हाम्रो टोलको ढल व्यवस्थापन नभएकाले घरहरूमा पानी पस्छ। वर्षातमा झनै समस्या।", "Infrastructure", 8,
     "ढल व्यवस्थापन नभएकाले घरमा पानी पस्छ, वर्षातमा झनै समस्या हुन्छ"),
    ("Road construction started 2 years back, still half done. Contractor disappeared. Ward office says not their problem.", "Infrastructure", 8,
     "सडक निर्माण २ वर्षदेखि अधुरो, ठेकेदार हराएको छ, वडाले जिम्मेवारी लिँदैन"),
    ("Street lights of our ward are non functional for 4 months. Ward office not responding to complaints.", "Infrastructure", 6,
     "हाम्रो वडाका सडक बत्तीहरू ४ महिनादेखि बन्द छन्, वडा कार्यालय मौन"),
    ("Footpath ma pasal walaharu le rakhe chhann, pedestrian chalna nai sakdaina. Municipality le action liena.", "Infrastructure", 5,
     "फुटपाथमा पसले सामान राख्छन्, पैदल यात्री हिँड्न सक्दैनन्, नगरपालिकाले कारबाही गरेन"),
    ("नयाँ सडक बनाउने भनेर घर भत्काइयो तर सडक बनेन। ३ वर्ष भयो।", "Infrastructure", 9,
     "नयाँ सडक बनाउने भनेर घर भत्काइयो, ३ वर्ष भयो सडक बनेन"),
    ("Construction work ma quality kharab cha. Ek barsa nabhako bato phatisakyo. Cement pani kam lagayo jasto cha.", "Infrastructure", 8,
     "निर्माणमा गुणस्तर कमजोर, एक वर्ष नभक्कै सडक भाँचिसक्यो, सिमेन्ट कम लगाएजस्तो"),
    ("Lalitpur ward 4 ma 6 mahina dekhi khanepani ko pipe phatieko cha. Repair nai bhayena.", "Infrastructure", 7,
     "ललितपुर वडा ४ मा खानेपानी पाइप ६ महिनादेखि भाँचिएको, मर्मत भएको छैन"),
    ("Road expansion ko naam ma tree katyo tara road banekai chaina. Environmental loss matra bhayo.", "Infrastructure", 7,
     "सडक विस्तारको नाममा रूख काटियो तर सडक बनेन, वातावरणीय क्षति मात्र भयो"),

    # Health (10)
    ("Hamro ward ko health post ma doctor hudaina. Medicine bhi limited cha. Biramiharu Kathmandu dhaunadai cha.", "Health", 8,
     "हाम्रो वडाको स्वास्थ्य चौकीमा डाक्टर छैन, औषधि पनि सीमित छ, बिरामी काठमाडौं धाउँछन्"),
    ("सरकारी अस्पतालमा निःशुल्क उपचार पाउनु पर्नेमा पैसा माग्छन्। गरिबहरू के गर्ने?", "Health", 9,
     "सरकारी अस्पतालमा निःशुल्क उपचारको सट्टा पैसा माग्छन्, गरिब नागरिक किन्काण"),
    ("Emergency ma gayo, doctor bhanyo 3 ghanta kura, serious biramiko haalat bhai sakyo.", "Health", 9,
     "आपतकालमा डाक्टरले ३ घण्टा कुर्न भने, गम्भीर बिरामीको हालत बिग्रियो"),
    ("Medicine shortage at district hospital. Patients being told to buy from private pharmacy at 3x price.", "Health", 8,
     "जिल्ला अस्पतालमा औषधि सकिएको छ, बिरामीलाई निजी फार्मेसीमा तीन गुणा मूल्यमा किन्न बाध्य पारिन्छ"),
    ("हाम्रो क्षेत्रमा dengue fever बढेको छ। स्वास्थ्य विभागले spray गरेको छैन।", "Health", 8,
     "हाम्रो क्षेत्रमा डेंगु ज्वरो फैलिँदैछ, स्वास्थ्य विभागले स्प्रे गरेको छैन"),
    ("Health post ma nurse matra huncha, doctor kabhi pani hudaina. Delivery case aayo pani Kathmandu pathaucha.", "Health", 7,
     "स्वास्थ्य चौकीमा नर्स मात्र छन्, डाक्टर कहिल्यै हुँदैनन्, प्रसूति केस काठमाडौं पठाउँछन्"),
    ("Ambulance call garyo, 1 ghanta pछि aayo. Biramile bato ma nai problem bhayo.", "Health", 9,
     "एम्बुलेन्स बोलाउँदा एक घण्टापछि आयो, बिरामीको बाटोमा नै अवस्था बिग्रियो"),
    ("Mental health services rural area ma zero cha. Kathmandu matra focus garyo government le.", "Health", 7,
     "ग्रामीण क्षेत्रमा मानसिक स्वास्थ्य सेवा शून्य छ, सरकार काठमाडौंमा मात्र केन्द्रित"),
    ("Vaccination camp announcement garyo tara vaccine nai aayena. Bachhaharu le vaccine painan.", "Health", 8,
     "खोप शिविर घोषणा भयो तर खोप आएन, बालबालिकाले खोप पाएनन्"),
    ("Government hospital ma X-ray machine 3 mahina dekhi kharab cha. Patient haru private ma janu parcha.", "Health", 7,
     "सरकारी अस्पतालको एक्स-रे मेसिन ३ महिनादेखि बिग्रिएको, बिरामी निजी अस्पतालमा जान बाध्य"),

    # Water/Electricity (8)
    ("KUKL ko pani 3 hapta dekhi aayena. Phone garyo, engage nai huncha. Online complaint bhi response bhayena.", "Water", 8,
     "KUKL को पानी ३ हप्तादेखि आएन, फोन व्यस्त हुन्छ, अनलाइन उजुरीको कुनै जवाफ छैन"),
    ("हाम्रो वडामा खानेपानी हप्तामा एक पटक मात्र आउँछ। KUKL ले सुन्दैन।", "Water", 8,
     "हाम्रो वडामा खानेपानी हप्तामा एकपटक मात्र आउँछ, KUKL ले सुन्दैन"),
    ("Biratnagar ma bijuli load shedding 12 ghanta per day huncha. NEA le kei bhandaina.", "Electricity", 7,
     "बिराटनगरमा प्रतिदिन १२ घण्टा लोडसेडिङ, NEA मौन छ"),
    ("Transformer blast bhayo, 2 hapta bhai sakyo bijuli chaina hamro entire muhalla ma.", "Electricity", 9,
     "ट्रान्सफर्मर जलेको २ हप्ता भयो, पूरा टोलमा बिजुली छैन"),
    ("Water supply contaminated in our area. Diarrhea cases increasing. Municipality not testing water quality.", "Water", 9,
     "हाम्रो क्षेत्रको पानी दूषित छ, झाडापखाला बढ्दैछ, नगरपालिकाले पानी परीक्षण गरेको छैन"),
    ("NEA ko bijuli bill double aayo kei karan bina. Office gayo, queue ma 4 ghanta basyo, solution bhayena.", "Electricity", 6,
     "NEA को बिजुली बिल कारण बिना दोब्बर आयो, कार्यालयमा ४ घण्टा लाइनमा बसेर पनि समाधान भएन"),
    ("Underground pipe broke. Road flooded with sewage. Municipality said they'll fix in 3 days, 2 weeks gone.", "Water", 8,
     "भूमिगत पाइप फुट्यो, सडकमा ढल भरिएको छ, नगरपालिकाले 'तीन दिनमा' भनेको २ हप्ता भइसक्यो"),
    ("Solar subsidy scheme ko form bharyo, 1 barsa bhai sakyo, kei update bhayena. Rs 50,000 ma application stuck cha.", "Electricity", 6,
     "सौर्य अनुदान योजनाको फाराम भरेको एक वर्ष भयो, ५०,०००रु आवेदन अड्किएको छ"),

    # Corruption/Safety (5)
    ("Ward office ma government service lina Rs 2000 ghus dina parcha bhanyo. Kasailai bhanna garo cha.", "Corruption", 9,
     "वडा कार्यालयमा सरकारी सेवाका लागि रु.२,००० घूस माग्छन्, कसैलाई भन्न पनि डर लाग्छ"),
    ("Contractor le inferior material use garyo road ma, inspector le pass garidiyo. Clearly corrupt deal cha.", "Corruption", 9,
     "ठेकेदारले सडकमा कमजोर सामग्री प्रयोग गर्यो, निरीक्षकले पास गरिदिए, भ्रष्ट सम्झौता स्पष्ट"),
    ("सरकारी जग्गाको नक्सा पास गर्न भ्रष्टाचार चलिरहेको छ। नागरिकले पैसा नदिए काम हुँदैन।", "Corruption", 9,
     "सरकारी जग्गाको नक्सा पास गर्न भ्रष्टाचार चलिरहेको छ, पैसा नदिए काम हुँदैन"),
    ("हाम्रो क्षेत्रमा चोरीको घटना बढेको छ तर प्रहरीले ध्यान दिँदैन।", "Safety", 7,
     "हाम्रो क्षेत्रमा चोरीका घटना बढिरहेका छन् तर प्रहरीले ध्यान दिँदैन"),
    ("Road accident blackspot identified 2 years ago. Speed breaker still not installed. 3 accidents happened.", "Safety", 8,
     "२ वर्षदेखि सडक दुर्घटना हुने ठाउँ पहिचान भएको छ, स्पिड ब्रेकर अझै राखिएन, ३ दुर्घटना भइसके"),
]

def main():
    from sentence_transformers import SentenceTransformer
    
    print("Loading embedding model (one-time download ~90MB)...")
    model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")
    print("Model loaded.")

    # Get ward IDs
    wards_res = db.table("wards").select("id, name_ne, municipality").execute()
    wards = wards_res.data
    if not wards:
        print("ERROR: No wards found. Run schema.sql in Supabase first.")
        return
    
    # Get ministry mappings
    min_res = db.table("ministries").select("id, slug").execute()
    ministry_map = {m["slug"]: m["id"] for m in min_res.data}
    
    category_to_ministry = {
        "Education": "education",
        "Infrastructure": "infrastructure",
        "Health": "health",
        "Water": "energy-water",
        "Electricity": "energy-water",
        "Corruption": "ciaa",
        "Safety": "home-affairs",
    }
    
    category_ne_map = {
        "Education": "शिक्षा",
        "Infrastructure": "पूर्वाधार",
        "Health": "स्वास्थ्य",
        "Water": "खानेपानी",
        "Electricity": "बिजुली",
        "Corruption": "भ्रष्टाचार",
        "Safety": "सुरक्षा",
    }

    print(f"Inserting {len(COMPLAINTS)} complaints with embeddings...")
    
    # Weight Kathmandu wards more (wards 0-5 in our seed = Kathmandu/Lalitpur)
    kathmandu_wards = [w for w in wards if "Kathmandu" in w.get("municipality", "") or "Lalitpur" in w.get("municipality", "")]
    other_wards = [w for w in wards if w not in kathmandu_wards]

    for i, (text, category_en, severity, summary_ne) in enumerate(COMPLAINTS):
        print(f"  [{i+1}/{len(COMPLAINTS)}] Embedding: {text[:60]}...")

        # Get embedding
        embedding = model.encode(text, normalize_embeddings=True).tolist()

        # Pick ward (70% Kathmandu)
        if kathmandu_wards and random.random() < 0.7:
            ward = random.choice(kathmandu_wards)
        elif other_wards:
            ward = random.choice(other_wards)
        else:
            ward = random.choice(wards)

        ministry_slug = category_to_ministry.get(category_en, "home-affairs")
        ministry_id = ministry_map.get(ministry_slug)

        db.table("complaints").insert({
            "text": text,
            "category_en": category_en,
            "category_ne": category_ne_map.get(category_en, "अन्य"),
            "severity": severity,
            "summary_ne": summary_ne,
            "summary_en": text[:120],
            "ward_id": ward["id"],
            "ministry_id": ministry_id,
            "embedding": embedding,
            "status": "active",
        }).execute()

    print(f"\nDone. {len(COMPLAINTS)} complaints inserted with embeddings.")
    print("Now trigger clustering: POST http://localhost:8000/api/run-clustering")

if __name__ == "__main__":
    main()
