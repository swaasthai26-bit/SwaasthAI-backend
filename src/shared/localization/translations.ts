// Centralized translation strings for all supported languages
// Supports: en (English), hi (Hindi), or (Odia)

export type SupportedLocale = 'en' | 'hi' | 'or';

export const SUPPORTED_LOCALES: SupportedLocale[] = ['en', 'hi', 'or'];
export const DEFAULT_LOCALE: SupportedLocale = 'en';

export const translations: Record<SupportedLocale, Record<string, string>> = {
  en: {
    // Auth related
    'auth.login.success': 'Login successful',
    'auth.login.failed': 'Login failed',
    'auth.signup.success': 'Signup successful',
    'auth.signup.failed': 'Signup failed',
    'auth.logout.success': 'Logout successful',
    'auth.token.invalid': 'Invalid or expired token',
    'auth.password.reset.success': 'Password reset successful',
    'auth.password.reset.failed': 'Password reset failed',
    'auth.unauthorized': 'Unauthorized access',
    
    // User related
    'user.not.found': 'User not found',
    'user.already.exists': 'User already exists',
    'user.profile.updated': 'User profile updated successfully',
    'user.profile.update.failed': 'Failed to update user profile',
    'user.deleted': 'User deleted successfully',
    
    // Hospital related
    'hospital.not.found': 'Hospital not found',
    'hospital.created': 'Hospital created successfully',
    'hospital.updated': 'Hospital updated successfully',
    'hospital.deleted': 'Hospital deleted successfully',
    'hospital.list.empty': 'No hospitals found',
    
    // Doctor related
    'doctor.not.found': 'Doctor not found',
    'doctor.created': 'Doctor created successfully',
    'doctor.updated': 'Doctor updated successfully',
    'doctor.deleted': 'Doctor deleted successfully',
    'doctor.list.empty': 'No doctors found',
    
    // Insurance related
    'insurance.plan.not.found': 'Insurance plan not found',
    'insurance.plan.created': 'Insurance plan created successfully',
    'insurance.plan.updated': 'Insurance plan updated successfully',
    'insurance.plan.deleted': 'Insurance plan deleted successfully',
    
    // Booking related
    'booking.not.found': 'Booking not found',
    'booking.created': 'Booking created successfully',
    'booking.updated': 'Booking updated successfully',
    'booking.cancelled': 'Booking cancelled successfully',
    
    // Review related
    'review.not.found': 'Review not found',
    'review.created': 'Review created successfully',
    'review.deleted': 'Review deleted successfully',
    
    // Validation errors
    'validation.invalid.email': 'Invalid email address',
    'validation.invalid.phone': 'Invalid phone number',
    'validation.password.weak': 'Password must be at least 8 characters',
    'validation.required.field': 'This field is required',
    'validation.invalid.date': 'Invalid date format',
    
    // Generic errors
    'error.server': 'Internal server error',
    'error.not.found': 'Resource not found',
    'error.bad.request': 'Bad request',
    'error.forbidden': 'Access forbidden',
    'error.conflict': 'Resource already exists',
    'error.timeout': 'Request timeout',
    
    // Search
    'search.no.results': 'No results found',
    'search.invalid.query': 'Invalid search query',
    
    // Notification
    'notification.sent': 'Notification sent successfully',
    'notification.not.found': 'Notification not found',

    // Specializations
    'specialization.cardiology': 'Cardiology',
    'specialization.neurology': 'Neurology',
    'specialization.orthopedics': 'Orthopedics',
    'specialization.pediatrics': 'Pediatrics',
    'specialization.dermatology': 'Dermatology',
    'specialization.gynecology': 'Gynecology',
    'specialization.oncology': 'Oncology',
    'specialization.urology': 'Urology',
    'specialization.gastroenterology': 'Gastroenterology',
    'specialization.pulmonology': 'Pulmonology',
    'specialization.nephrology': 'Nephrology',
    'specialization.hepatology': 'Hepatology',
    'specialization.rheumatology': 'Rheumatology',
    'specialization.endocrinology': 'Endocrinology',
    'specialization.psychiatry': 'Psychiatry',
    'specialization.dental': 'Dental',
    'specialization.ent': 'ENT (Ear, Nose, Throat)',
    'specialization.ophthalmology': 'Ophthalmology',
    'specialization.general_physician': 'General Physician',
    'specialization.emergency_medicine': 'Emergency Medicine',
    'specialization.physical_therapy': 'Physical Therapy',
    'specialization.radiology': 'Radiology',
    'specialization.pathology': 'Pathology',
    'specialization.anesthesiology': 'Anesthesiology',
    'specialization.surgery': 'Surgery',
  },
  
  hi: {
    // Auth related
    'auth.login.success': 'लॉगिन सफल रहा',
    'auth.login.failed': 'लॉगिन विफल रहा',
    'auth.signup.success': 'साइनअप सफल रहा',
    'auth.signup.failed': 'साइनअप विफल रहा',
    'auth.logout.success': 'लॉगआउट सफल रहा',
    'auth.token.invalid': 'अमान्य या समाप्त टोकन',
    'auth.password.reset.success': 'पासवर्ड रीसेट सफल रहा',
    'auth.password.reset.failed': 'पासवर्ड रीसेट विफल रहा',
    'auth.unauthorized': 'अनधिकृत पहुंच',
    
    // User related
    'user.not.found': 'उपयोगकर्ता नहीं मिला',
    'user.already.exists': 'उपयोगकर्ता पहले से मौजूद है',
    'user.profile.updated': 'उपयोगकर्ता प्रोफ़ाइल सफलतापूर्वक अपडेट किया गया',
    'user.profile.update.failed': 'उपयोगकर्ता प्रोफ़ाइल अपडेट करने में विफल',
    'user.deleted': 'उपयोगकर्ता सफलतापूर्वक हटाया गया',
    
    // Hospital related
    'hospital.not.found': 'अस्पताल नहीं मिला',
    'hospital.created': 'अस्पताल सफलतापूर्वक बनाया गया',
    'hospital.updated': 'अस्पताल सफलतापूर्वक अपडेट किया गया',
    'hospital.deleted': 'अस्पताल सफलतापूर्वक हटाया गया',
    'hospital.list.empty': 'कोई अस्पताल नहीं मिला',
    
    // Doctor related
    'doctor.not.found': 'डॉक्टर नहीं मिला',
    'doctor.created': 'डॉक्टर सफलतापूर्वक बनाया गया',
    'doctor.updated': 'डॉक्टर सफलतापूर्वक अपडेट किया गया',
    'doctor.deleted': 'डॉक्टर सफलतापूर्वक हटाया गया',
    'doctor.list.empty': 'कोई डॉक्टर नहीं मिला',
    
    // Insurance related
    'insurance.plan.not.found': 'बीमा योजना नहीं मिली',
    'insurance.plan.created': 'बीमा योजना सफलतापूर्वक बनाई गई',
    'insurance.plan.updated': 'बीमा योजना सफलतापूर्वक अपडेट की गई',
    'insurance.plan.deleted': 'बीमा योजना सफलतापूर्वक हटाई गई',
    
    // Booking related
    'booking.not.found': 'बुकिंग नहीं मिली',
    'booking.created': 'बुकिंग सफलतापूर्वक बनाई गई',
    'booking.updated': 'बुकिंग सफलतापूर्वक अपडेट की गई',
    'booking.cancelled': 'बुकिंग सफलतापूर्वक रद्द की गई',
    
    // Review related
    'review.not.found': 'समीक्षा नहीं मिली',
    'review.created': 'समीक्षा सफलतापूर्वक बनाई गई',
    'review.deleted': 'समीक्षा सफलतापूर्वक हटाई गई',
    
    // Validation errors
    'validation.invalid.email': 'अमान्य ईमेल पता',
    'validation.invalid.phone': 'अमान्य फोन नंबर',
    'validation.password.weak': 'पासवर्ड कम से कम 8 वर्ण होना चाहिए',
    'validation.required.field': 'यह क्षेत्र आवश्यक है',
    'validation.invalid.date': 'अमान्य तारीख प्रारूप',
    
    // Generic errors
    'error.server': 'आंतरिक सर्वर त्रुटि',
    'error.not.found': 'संसाधन नहीं मिला',
    'error.bad.request': 'खराब अनुरोध',
    'error.forbidden': 'पहुंच निषिद्ध',
    'error.conflict': 'संसाधन पहले से मौजूद है',
    'error.timeout': 'अनुरोध समय समाप्त',
    
    // Search
    'search.no.results': 'कोई परिणाम नहीं मिला',
    'search.invalid.query': 'अमान्य खोज क्वेरी',
    
    // Notification
    'notification.sent': 'सूचना सफलतापूर्वक भेजी गई',
    'notification.not.found': 'सूचना नहीं मिली',

    // Specializations
    'specialization.cardiology': 'हृदय रोग विज्ञान',
    'specialization.neurology': 'तंत्रिका विज्ञान',
    'specialization.orthopedics': 'हड्डी रोग',
    'specialization.pediatrics': 'बाल रोग',
    'specialization.dermatology': 'त्वचा विज्ञान',
    'specialization.gynecology': 'स्त्री रोग',
    'specialization.oncology': 'कैंसर विज्ञान',
    'specialization.urology': 'मूत्र रोग',
    'specialization.gastroenterology': 'जठरांत्र विज्ञान',
    'specialization.pulmonology': 'फुफ्फुस विज्ञान',
    'specialization.nephrology': 'वृक्क रोग',
    'specialization.hepatology': 'यकृत विज्ञान',
    'specialization.rheumatology': 'संधिवात विज्ञान',
    'specialization.endocrinology': 'अंतःस्रावी विज्ञान',
    'specialization.psychiatry': 'मनोचिकित्सा',
    'specialization.dental': 'दंत चिकित्सा',
    'specialization.ent': 'कान, नाक और गला',
    'specialization.ophthalmology': 'नेत्र विज्ञान',
    'specialization.general_physician': 'सामान्य चिकित्सक',
    'specialization.emergency_medicine': 'आपातकालीन चिकित्सा',
    'specialization.physical_therapy': 'भौतिक चिकित्सा',
    'specialization.radiology': 'रेडियोलॉजी',
    'specialization.pathology': 'विकृति विज्ञान',
    'specialization.anesthesiology': 'संज्ञाहरण विज्ञान',
    'specialization.surgery': 'शल्य चिकित्सा',
  },
  
  or: {
    // Auth related
    'auth.login.success': 'ଲଗଇନ ସଫଳ ହୋଇଛି',
    'auth.login.failed': 'ଲଗଇନ ବିଫଳ ହୋଇଛି',
    'auth.signup.success': 'ସାଇନଅପ ସଫଳ ହୋଇଛି',
    'auth.signup.failed': 'ସାଇନଅପ ବିଫଳ ହୋଇଛି',
    'auth.logout.success': 'ଲଗଆଉଟ ସଫଳ ହୋଇଛି',
    'auth.token.invalid': 'ଅବୈଧ କିମ୍ବା ସମାପ୍ତ ଟୋକେନ',
    'auth.password.reset.success': 'ପାସୱାର୍ଡ ରିସେଟ ସଫଳ ହୋଇଛି',
    'auth.password.reset.failed': 'ପାସୱାର୍ଡ ରିସେଟ ବିଫଳ ହୋଇଛି',
    'auth.unauthorized': 'ଅନୁମୋଦିତ ପ୍ରବେଶାଧିକାର ନାହିଁ',
    
    // User related
    'user.not.found': 'ଚାଳକ ମିଳିଲା ନାହିଁ',
    'user.already.exists': 'ଚାଳକ ପୂର୍ବରୁ ବିଦ୍ୟମାନ ଅଛି',
    'user.profile.updated': 'ଚାଳକ ପ୍ରୋଫାଇଲ ସଫଳତାର ସହିତ ଅପଡେଟ କରାଯାଇଛି',
    'user.profile.update.failed': 'ଚାଳକ ପ୍ରୋଫାଇଲ ଅପଡେଟ କରିବାରେ ବିଫଳ',
    'user.deleted': 'ଚାଳକ ସଫଳତାର ସହିତ ଡିଲିଟ କରାଯାଇଛି',
    
    // Hospital related
    'hospital.not.found': 'ଡାକ୍ତରଖାନା ମିଳିଲା ନାହିଁ',
    'hospital.created': 'ଡାକ୍ତରଖାନା ସଫଳତାର ସହିତ ତୈରି କରାଯାଇଛି',
    'hospital.updated': 'ଡାକ୍ତରଖାନା ସଫଳତାର ସହିତ ଅପଡେଟ କରାଯାଇଛି',
    'hospital.deleted': 'ଡାକ୍ତରଖାନା ସଫଳତାର ସହିତ ଡିଲିଟ କରାଯାଇଛି',
    'hospital.list.empty': 'କୌଣସି ଡାକ୍ତରଖାନା ମିଳିଲା ନାହିଁ',
    
    // Doctor related
    'doctor.not.found': 'ଡାକ୍ତର ମିଳିଲେ ନାହିଁ',
    'doctor.created': 'ଡାକ୍ତର ସଫଳତାର ସହିତ ତୈରି କରାଯାଇଛି',
    'doctor.updated': 'ଡାକ୍ତର ସଫଳତାର ସହିତ ଅପଡେଟ କରାଯାଇଛି',
    'doctor.deleted': 'ଡାକ୍ତର ସଫଳତାର ସହିତ ଡିଲିଟ କରାଯାଇଛି',
    'doctor.list.empty': 'କୌଣସି ଡାକ୍ତର ମିଳିଲେ ନାହିଁ',
    
    // Insurance related
    'insurance.plan.not.found': 'ବୀମା ଯୋଜନା ମିଳିଲା ନାହିଁ',
    'insurance.plan.created': 'ବୀମା ଯୋଜନା ସଫଳତାର ସହିତ ତୈରି କରାଯାଇଛି',
    'insurance.plan.updated': 'ବୀମା ଯୋଜନା ସଫଳତାର ସହିତ ଅପଡେଟ କରାଯାଇଛି',
    'insurance.plan.deleted': 'ବୀମା ଯୋଜନା ସଫଳତାର ସହିତ ଡିଲିଟ କରାଯାଇଛି',
    
    // Booking related
    'booking.not.found': 'ବୁକିଂ ମିଳିଲା ନାହିଁ',
    'booking.created': 'ବୁକିଂ ସଫଳତାର ସହିତ ତୈରି କରାଯାଇଛି',
    'booking.updated': 'ବୁକିଂ ସଫଳତାର ସହିତ ଅପଡେଟ କରାଯାଇଛି',
    'booking.cancelled': 'ବୁକିଂ ସଫଳତାର ସହିତ ବାତିଲ କରାଯାଇଛି',
    
    // Review related
    'review.not.found': 'ସମୀକ୍ଷା ମିଳିଲା ନାହିଁ',
    'review.created': 'ସମୀକ୍ଷା ସଫଳତାର ସହିତ ତୈରି କରାଯାଇଛି',
    'review.deleted': 'ସମୀକ୍ଷା ସଫଳତାର ସହିତ ଡିଲିଟ କରାଯାଇଛି',
    
    // Validation errors
    'validation.invalid.email': 'ଅବୈଧ ଇମେଲ ଠିକଣା',
    'validation.invalid.phone': 'ଅବୈଧ ଫୋନ ନମ୍ବର',
    'validation.password.weak': 'ପାସୱାର୍ଡ ଅତିକମରେ 8 ଅକ୍ଷର ହେବା ଆବଶ୍ୟକ',
    'validation.required.field': 'ଏହି ଫିଲ୍ଡ ଆବଶ୍ୟକ',
    'validation.invalid.date': 'ଅବୈଧ ତାରିଖ ଫର୍ମାଟ',
    
    // Generic errors
    'error.server': 'ଆଭ୍ୟନ୍ତରୀଣ ସର୍ବର ତ୍ରୁଟି',
    'error.not.found': 'ସମ୍ପଦ ମିଳିଲା ନାହିଁ',
    'error.bad.request': 'ଖରାପ ଅନୁରୋଧ',
    'error.forbidden': 'ପ୍ରବେଶାଧିକାର ନିଷିଦ୍ଧ',
    'error.conflict': 'ସମ୍ପଦ ପୂର୍ବରୁ ବିଦ୍ୟମାନ ଅଛି',
    'error.timeout': 'ଅନୁରୋଧ ସମୟ ସମାପ୍ତ',
    
    // Search
    'search.no.results': 'କୌଣସି ଫଳାଫଳ ମିଳିଲା ନାହିଁ',
    'search.invalid.query': 'ଅବୈଧ ସର୍ଚ୍ଚ କ୍ୱେରୀ',
    
    // Notification
    'notification.sent': 'ବିଜ୍ଞପ୍ତି ସଫଳତାର ସହିତ ପଠାଯାଇଛି',
    'notification.not.found': 'ବିଜ୍ଞପ୍ତି ମିଳିଲା ନାହିଁ',

    // Specializations
    'specialization.cardiology': 'ହୃଦ୍ ରୋଗ ବିଜ୍ଞାନ',
    'specialization.neurology': 'ସ୍ନାୟୁ ବିଜ୍ଞାନ',
    'specialization.orthopedics': 'ଅସ୍ଥି ଚିକିତ୍ସା',
    'specialization.pediatrics': 'ଶିଶୁ ରୋଗ',
    'specialization.dermatology': 'ଚର୍ମ ବିଜ୍ଞାନ',
    'specialization.gynecology': 'ସ୍ତ୍ରୀ ରୋଗ',
    'specialization.oncology': 'କର୍କଟ ରୋଗ ବିଜ୍ଞାନ',
    'specialization.urology': 'ମୂତ୍ର ରୋଗ',
    'specialization.gastroenterology': 'ପାକସ୍ଥଳୀ ବିଜ୍ଞାନ',
    'specialization.pulmonology': 'ଫୁସ୍ଫୁସ ବିଜ୍ଞାନ',
    'specialization.nephrology': 'ବୃକ୍କ ରୋଗ',
    'specialization.hepatology': 'ଯକୃତ ବିଜ୍ଞାନ',
    'specialization.rheumatology': 'ସନ୍ଧି ରୋଗ ବିଜ୍ଞାନ',
    'specialization.endocrinology': 'ଅନ୍ତଃସ୍ରାବ ବିଜ୍ଞାନ',
    'specialization.psychiatry': 'ମନୋଚିକିତ୍ସା',
    'specialization.dental': 'ଦନ୍ତ ଚିକିତ୍ସା',
    'specialization.ent': 'କାନ, ନାକ ଓ ଗଳା',
    'specialization.ophthalmology': 'ନେତ୍ର ବିଜ୍ଞାନ',
    'specialization.general_physician': 'ସାଧାରଣ ଚିକିତ୍ସକ',
    'specialization.emergency_medicine': 'ଜରୁରୀ ଚିକିତ୍ସା',
    'specialization.physical_therapy': 'ଭୌତିକ ଚିକିତ୍ସା',
    'specialization.radiology': 'ରେଡିଓଲୋଜି',
    'specialization.pathology': 'ରୋଗ ବିଜ୍ଞାନ',
    'specialization.anesthesiology': 'ଅବେଦନ ବିଜ୍ଞାନ',
    'specialization.surgery': 'ଶଲ୍ୟ ଚିକିତ୍ସା',
  },
};
