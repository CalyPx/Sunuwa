"""
Migration: update summary_ne for all existing complaints that have generic placeholders.
Run once: python fix_summaries.py
"""
import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()
db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

# Map: first ~60 chars of text -> proper summary_ne
SUMMARY_MAP = {
    "NEB Grade 12 result chado aayo": "NEB कक्षा १२ को नतिजामा गुणस्तर कमजोर, पुनः परीक्षा शुल्क १,०००रु गरिबका लागि मँहगो",
    "Hamro school ma teacher nai hudaina": "विद्यालयमा शिक्षक नै आउँदैनन्, हरेक हप्ता ३-४ दिन बन्द, बालबालिकाको पढाइ बर्बाद भइसक्यो",
    "सरकारी विद्यालयमा पाठ्यपुस्तक समयमा आएन": "सरकारी विद्यालयमा वर्ष आधा सकिए पनि पाठ्यपुस्तक आएन",
    "NEB ko practical exam ma irregularity": "NEB प्रयोगात्मक परीक्षामा अनियमितता, बाह्य परीक्षक नआई विद्यालयकै शिक्षकले अंक दिए",
    "Scholarship ko form bharna gayo": "छात्रवृत्ति फाराम भर्न गयो, ३ हप्तादेखि 'सर्भर डाउन' भनेर फिर्ता पठाइन्छ",
    "Our village school has only one teacher": "हाम्रो गाउँको विद्यालयमा ५ कक्षाका लागि एकजना मात्र शिक्षक, बालबालिका अधिकांश समय खाली बस्छन्",
    "Campus ma exam form fill garda extra charge": "क्याम्पसमा परीक्षा फाराम भर्दा थप रु.२,००० लिइयो, रसिद दिइएन, भ्रष्टाचार स्पष्ट छ",
    "सामुदायिक विद्यालयको भवन जीर्ण छ": "सामुदायिक विद्यालयको जीर्ण भवनबाट पानी पर्दा छाना चुहिन्छ, बालबालिका पढ्न सक्दैनन्",
    "Grade 11 ma admit huna gayera": "कक्षा ११ दर्ताका लागि ६ महिनादेखि कुनै प्रतिक्रिया छैन",
    "SLC result ma mero number galthi": "SLC नतिजामा अंक गल्ती छ, सच्याउन गएकोमा २ महिना भयो, समाधान भएन",
    "Government school teachers absent rahanchan": "सरकारी विद्यालयका शिक्षक अनुपस्थित रहन्छन् र निजी ट्युसन पढाउँछन्, कारबाही हुनुपर्छ",
    "हाम्रो वडामा माध्यमिक विद्यालय छैन": "हाम्रो वडामा माध्यमिक विद्यालय छैन, बालबालिकाले ५ किमि हिँड्नुपर्छ",
    "University library 5 PM ma banda": "विश्वविद्यालय पुस्तकालय साँझ ५ बजे बन्द हुन्छ, परीक्षाको समयमा पनि",
    "Education ministry ko website 2 mahina": "शिक्षा मन्त्रालयको वेबसाइट २ महिनादेखि बन्द, अनलाइन फाराम भर्न असम्भव",
    "Hostel fee Rs 80000 tira gayo": "छात्रावास शुल्क ८०,०००रु भयो तर सुविधा शून्य छ",
    "Hamro ward ko mula bato 8 mahina": "हाम्रो वडाको मुख्य सडक ८ महिनादेखि भाँचिएको छ, मर्मत गर्न कोही आएन",
    "सडकमा ठूलो खाडल छ": "सडकको ठूलो खाडलले गत हप्ता मोटरसाइकल दुर्घटना भयो, वडा कार्यालयले सुनेन",
    "The bridge in our village has developed cracks": "हाम्रो गाउँको पुलमा दरार परेको छ, इन्जिनियरले ६ महिना पहिले मर्मत आवश्यक भनेका थिए",
    "Kathmandu ma pothole everywhere cha": "काठमाडौंमा हरतर्फ खाडल छ, मनसुन र सुक्खायाम दुवैमा समाधान छैन",
    "हाम्रो टोलको ढल व्यवस्थापन": "ढल व्यवस्थापन नभएकाले घरमा पानी पस्छ, वर्षातमा झनै समस्या हुन्छ",
    "Road construction started 2 years back": "सडक निर्माण २ वर्षदेखि अधुरो, ठेकेदार हराएको छ, वडाले जिम्मेवारी लिँदैन",
    "Street lights of our ward are non functional": "हाम्रो वडाका सडक बत्तीहरू ४ महिनादेखि बन्द छन्, वडा कार्यालय मौन",
    "Footpath ma pasal walaharu le rakhe": "फुटपाथमा पसले सामान राख्छन्, पैदल यात्री हिँड्न सक्दैनन्, नगरपालिकाले कारबाही गरेन",
    "नयाँ सडक बनाउने भनेर घर भत्काइयो": "नयाँ सडक बनाउने भनेर घर भत्काइयो, ३ वर्ष भयो सडक बनेन",
    "Construction work ma quality kharab cha": "निर्माणमा गुणस्तर कमजोर, एक वर्ष नभक्कै सडक भाँचिसक्यो, सिमेन्ट कम लगाएजस्तो",
    "Lalitpur ward 4 ma 6 mahina dekhi": "ललितपुर वडा ४ मा खानेपानी पाइप ६ महिनादेखि भाँचिएको, मर्मत भएको छैन",
    "Road expansion ko naam ma tree katyo": "सडक विस्तारको नाममा रूख काटियो तर सडक बनेन, वातावरणीय क्षति मात्र भयो",
    "Hamro ward ko health post ma doctor": "हाम्रो वडाको स्वास्थ्य चौकीमा डाक्टर छैन, औषधि पनि सीमित छ, बिरामी काठमाडौं धाउँछन्",
    "सरकारी अस्पतालमा निःशुल्क उपचार": "सरकारी अस्पतालमा निःशुल्क उपचारको सट्टा पैसा माग्छन्, गरिब नागरिक किन्काण",
    "Emergency ma gayo, doctor bhanyo 3 ghanta": "आपतकालमा डाक्टरले ३ घण्टा कुर्न भने, गम्भीर बिरामीको हालत बिग्रियो",
    "Medicine shortage at district hospital": "जिल्ला अस्पतालमा औषधि सकिएको छ, बिरामीलाई निजी फार्मेसीमा तीन गुणा मूल्यमा किन्न बाध्य पारिन्छ",
    "हाम्रो क्षेत्रमा dengue fever": "हाम्रो क्षेत्रमा डेंगु ज्वरो फैलिँदैछ, स्वास्थ्य विभागले स्प्रे गरेको छैन",
    "Health post ma nurse matra huncha": "स्वास्थ्य चौकीमा नर्स मात्र छन्, डाक्टर कहिल्यै हुँदैनन्, प्रसूति केस काठमाडौं पठाउँछन्",
    "Ambulance call garyo, 1 ghanta": "एम्बुलेन्स बोलाउँदा एक घण्टापछि आयो, बिरामीको बाटोमा नै अवस्था बिग्रियो",
    "Mental health services rural area": "ग्रामीण क्षेत्रमा मानसिक स्वास्थ्य सेवा शून्य छ, सरकार काठमाडौंमा मात्र केन्द्रित",
    "Vaccination camp announcement garyo tara vaccine": "खोप शिविर घोषणा भयो तर खोप आएन, बालबालिकाले खोप पाएनन्",
    "Government hospital ma X-ray machine": "सरकारी अस्पतालको एक्स-रे मेसिन ३ महिनादेखि बिग्रिएको, बिरामी निजी अस्पतालमा जान बाध्य",
    "KUKL ko pani 3 hapta dekhi aayena": "KUKL को पानी ३ हप्तादेखि आएन, फोन व्यस्त हुन्छ, अनलाइन उजुरीको कुनै जवाफ छैन",
    "हाम्रो वडामा खानेपानी हप्तामा": "हाम्रो वडामा खानेपानी हप्तामा एकपटक मात्र आउँछ, KUKL ले सुन्दैन",
    "Biratnagar ma bijuli load shedding": "बिराटनगरमा प्रतिदिन १२ घण्टा लोडसेडिङ, NEA मौन छ",
    "Transformer blast bhayo": "ट्रान्सफर्मर जलेको २ हप्ता भयो, पूरा टोलमा बिजुली छैन",
    "Water supply contaminated in our area": "हाम्रो क्षेत्रको पानी दूषित छ, झाडापखाला बढ्दैछ, नगरपालिकाले पानी परीक्षण गरेको छैन",
    "NEA ko bijuli bill double aayo": "NEA को बिजुली बिल कारण बिना दोब्बर आयो, कार्यालयमा ४ घण्टा लाइनमा बसेर पनि समाधान भएन",
    "Underground pipe broke": "भूमिगत पाइप फुट्यो, सडकमा ढल भरिएको छ, नगरपालिकाले 'तीन दिनमा' भनेको २ हप्ता भइसक्यो",
    "Solar subsidy scheme ko form bharyo": "सौर्य अनुदान योजनाको फाराम भरेको एक वर्ष भयो, ५०,०००रु आवेदन अड्किएको छ",
    "Ward office ma government service lina Rs 2000": "वडा कार्यालयमा सरकारी सेवाका लागि रु.२,००० घूस माग्छन्, कसैलाई भन्न पनि डर लाग्छ",
    "Contractor le inferior material use garyo": "ठेकेदारले सडकमा कमजोर सामग्री प्रयोग गर्यो, निरीक्षकले पास गरिदिए, भ्रष्ट सम्झौता स्पष्ट",
    "सरकारी जग्गाको नक्सा पास गर्न": "सरकारी जग्गाको नक्सा पास गर्न भ्रष्टाचार चलिरहेको छ, पैसा नदिए काम हुँदैन",
    "हाम्रो क्षेत्रमा चोरीको घटना": "हाम्रो क्षेत्रमा चोरीका घटना बढिरहेका छन् तर प्रहरीले ध्यान दिँदैन",
    "Road accident blackspot identified": "२ वर्षदेखि सडक दुर्घटना हुने ठाउँ पहिचान भएको छ, स्पिड ब्रेकर अझै राखिएन, ३ दुर्घटना भइसके",
}

def main():
    print("Fetching all complaints with generic summaries...")
    res = db.table("complaints").select("id, text, summary_ne").execute()
    complaints = res.data or []

    updated = 0
    for c in complaints:
        text = c.get("text", "")
        current = c.get("summary_ne", "")

        # Skip if already has a real summary (not the old generic format)
        generic_markers = ["सम्बन्धी समस्या दर्ज भयो", "complaint submitted"]
        is_generic = not current or any(m in (current or "") for m in generic_markers)

        if not is_generic:
            continue

        # Find matching summary by text prefix
        matched = None
        for prefix, summary in SUMMARY_MAP.items():
            if text.startswith(prefix) or prefix in text[:80]:
                matched = summary
                break

        if matched:
            db.table("complaints").update({"summary_ne": matched}).eq("id", c["id"]).execute()
            print(f"  Updated: {text[:50]}...")
            updated += 1

    print(f"\nDone. Updated {updated} of {len(complaints)} complaints.")

if __name__ == "__main__":
    main()
