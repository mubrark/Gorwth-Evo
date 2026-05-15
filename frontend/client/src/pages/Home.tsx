import { motion } from 'framer-motion';
import { Link, Element } from 'react-scroll';
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Send } from 'lucide-react';
import { 
  ArrowRight, CheckCircle, Zap, BarChart3, Star, Search,
  Share2, Lightbulb, TrendingUp, Users, Target, Rocket, Award
} from 'lucide-react';
import { apiClient } from '@/lib/api';


const HERO_IMAGE = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663314088284/jw6hSMN8Q7vSD5LeeBGsA4/hero-seo-2yJB4w9McKgeNKxGCZg7PT.webp';
const DASHBOARD_BG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663314088284/jw6hSMN8Q7vSD5LeeBGsA4/dashboard-bg-TMBWSV3aFu6TYfzVciiWyJ.webp';


interface Service {
  service_id: number;
  service_name: string; 
  service_code?: string; 
  description: string; 
  category?: string; 
  base_price?: number; 
  duration_days?: number; 
  features?: string;
  benefits?: string; 
  is_active: boolean;
 
  icon: React.ReactNode;
  color: string;
  featuresList?: string[];
  benefitsList?: string[];
  caseStudy?: {
    title: string;
    result: string;
    improvement: string;
  };
}

interface Package {
  package_id: number;
  package_name: string;
  package_code: string;
  description: string;
  price: number;
  duration_days: number;
  included_services: string;
  is_active: boolean;
}

/*
// دالة لاختيار الأيقونة بناءً على اسم الخدمة
const getIconByName = (serviceName: string) => {
  const name = serviceName.toLowerCase();
  if (name.includes('seo') || name.includes('تحسين محركات')) return <Search className="w-12 h-12" />;
  if (name.includes('اجتماعي') || name.includes('social')) return <Share2 className="w-12 h-12" />;
  if (name.includes('بيانات') || name.includes('data') || name.includes('تحليل')) return <BarChart3 className="w-12 h-12" />;
  if (name.includes('تحسين الموقع') || name.includes('performance')) return <Zap className="w-12 h-12" />;
  if (name.includes('استشارة')) return <Lightbulb className="w-12 h-12" />;
  if (name.includes('ppc') || name.includes('إعلانات')) return <TrendingUp className="w-12 h-12" />;
  return <Rocket className="w-12 h-12" />;
};
/*
// دالة لاختيار لون التدرج بناءً على id الخدمة
const getColorById = (id: number) => {
  const colors = [
    'from-blue-500 to-cyan-500',
    'from-pink-500 to-rose-500',
    'from-green-500 to-emerald-500',
    'from-yellow-500 to-orange-500',
    'from-purple-500 to-indigo-500',
    'from-red-500 to-pink-500',
  ];
  return colors[(id - 1) % colors.length];
};*/

export default function Home() {
  //const [, setLocation] = useLocation();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  //const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [activeTab, setActiveTab] = useState('benefits');
  const [selectedService, setSelectedService] = useState<Service | null >(null);

  
  const [, setLocation] = useLocation();
 // const [selectedService, setSelectedService] = useState<Service | null>(Homes[0]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [testimonials, setTestimonials] = useState<any[]>([]);
const [stats, setStats] = useState({
  total_reviews: 0,
  average_rating: 0,
  five_star: 0,
  four_star: 0,
  three_star: 0,
  two_star: 0,
  one_star: 0
});
const [isSubmitting, setIsSubmitting] = useState(false);
const [newReview, setNewReview] = useState({ name: '', company: '', rating: '5', comment: '' });
const [reviewMessage, setReviewMessage] = useState<{ type: 'success' | 'error', comment: string } | null>(null);


  
// دالة جلب الآراء والإحصائيات
const fetchTestimonials = async () => {
  try {
    const response = await fetch('http://localhost:5001/api/reviews');
    if (!response.ok) throw new Error('فشل في تحميل الآراء');
    const data = await response.json();
    setTestimonials(data.reviews);
    setStats(data.stats);
  } catch (err) {
    console.error(err);
  }
};

// دالة إضافة رأي جديد
const handleSubmitReview = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsSubmitting(true);
  setReviewMessage(null);
  try {
    const response = await fetch('http://localhost:5001/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newReview.name,
        company: newReview.company,
        rating: parseInt(newReview.rating),
        comment: newReview.comment
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'حدث خطأ');
    setReviewMessage({ type: 'success', comment: data.message });
    setNewReview({ name: '', company: '', rating: '5', comment: '' });
    // إعادة جلب الآراء بعد فترة (لأن الجديد يحتاج موافقة)
    setTimeout(fetchTestimonials, 3000);
  } catch (err: any) {
    setReviewMessage({ type: 'error', comment: err.message });
  } finally {
    setIsSubmitting(false);
  }
};

useEffect(() => {
  fetchTestimonials();
}, []);

  // جلب الخدمات من API
  useEffect(() => {
    const fetchServices = async () => {
      const response = await apiClient.request<Service[]>('/api/services', 'GET');
      if (response.data) {
        // تحويل البيانات إلى الشكل المطلوب مع إضافة أيقونات وألوان افتراضية
        const servicesWithIcons = response.data.map((service, index) => ({
          ...service,
          icon: getIconForService(service.service_name, index),
          color: getColorForService(index),
          benefitsList: parseBenefits(service.benefits),
          featuresList: parseFeatures(service.features),
          caseStudy: generateCaseStudy(service.service_name),
        }));
        setServices(servicesWithIcons);
        if (servicesWithIcons.length > 0) {
          setSelectedService(servicesWithIcons[0]);
        }
      } else {
        console.error('Failed to load services:', response.error);
      }
      setLoading(false);
    };
    fetchServices();
  }, []);

  // جلب الباقات من API باستخدام apiClient
  useEffect(() => {
    const fetchPackages = async () => {
      const response = await apiClient.request<Package[]>('/api/packages', 'GET');
      if (response.data) {
        setPackages(response.data);
      } else {
        console.error('Failed to load packages:', response.error);
      }
      setLoadingPackages(false);
    };
    fetchPackages();
  }, []);

  // دوال مساعدة لتوليد أيقونات وألوان ومزايا توافقية (لأن API لا يعيد هذه الحقول)
  const getIconForService = (name: string, index: number): React.ReactNode => {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('seo') || nameLower.includes('تحسين')) return <Search className="w-12 h-12" />;
    if (nameLower.includes('social') || nameLower.includes('وسائل')) return <Share2 className="w-12 h-12" />;
    if (nameLower.includes('تحليل') || nameLower.includes('data')) return <BarChart3 className="w-12 h-12" />;
    if (nameLower.includes('performance') || nameLower.includes('أداء')) return <Zap className="w-12 h-12" />;
    if (nameLower.includes('استشارة') || nameLower.includes('consult')) return <Lightbulb className="w-12 h-12" />;
    if (nameLower.includes('ppc') || nameLower.includes('إعلانات')) return <TrendingUp className="w-12 h-12" />;
    const icons = [<Search />, <Share2 />, <BarChart3 />, <Zap />, <Lightbulb />, <TrendingUp />];
    return icons[index % icons.length];
  };

  const getColorForService = (index: number): string => {
    const colors = [
      'from-blue-500 to-cyan-500',
      'from-pink-500 to-rose-500',
      'from-green-500 to-emerald-500',
      'from-yellow-500 to-orange-500',
      'from-purple-500 to-indigo-500',
      'from-red-500 to-pink-500',
    ];
    return colors[index % colors.length];
  };

  const parseBenefits = (benefitsStr?: string): string[] => {
    if (!benefitsStr) return ['لا توجد ميزات محددة'];
    try {
      const parsed = JSON.parse(benefitsStr);
      if (Array.isArray(parsed)) return parsed;
      return [benefitsStr];
    } catch {
      return benefitsStr.split(',').map(f => f.trim());
    }
  };

  const parseFeatures = (featuresStr?: string): string[] => {
    if (!featuresStr) return ['لا توجد ميزات محددة'];
    try {
      const parsed = JSON.parse(featuresStr);
      if (Array.isArray(parsed)) return parsed;
      return [featuresStr];
    } catch {
      return featuresStr.split(',').map(f => f.trim());
    }
  };

  const generateCaseStudy = (name: string) => {
    return {
      title: `دراسة حالة: ${name}`,
      result: 'زيادة النتائج بنسبة تزيد عن 200%',
      improvement: 'تحسن ملحوظ في مؤشرات الأداء الرئيسية',
    };
  };

  // دالة لتحويل inclusions (JSON string) إلى مصفوفة
  const parseInclusions = (inclusions: string): string[] => {
    try {
      const parsed = JSON.parse(inclusions);
      if (Array.isArray(parsed)) return parsed;
      return [inclusions];
    } catch {
      return inclusions.split(',').map(item => item.trim());
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">جاري تحميل المحتوى...</p>
        </div>
      </div>
    );
  }

  // عرض حالة الخطأ
  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️ {error}</div>
          <Button onClick={() => window.location.reload()} className="bg-blue-600 hover:bg-blue-700">
            إعادة المحاولة
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-blue-700">SEO</h1>
          <div className="flex gap-4">
            <Button
              onClick={() => setLocation('/login')}
              variant="outline"
              className="text-blue-600 border-blue-600 hover:bg-blue-50"
            >
              تسجيل الدخول
            </Button>
            <Button
              onClick={() => setLocation('/register')}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              إنشاء حساب
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
                احصل على أفضل خدمات تحسين محركات البحث
              </h1>
              <p className="text-xl text-gray-600 mb-8 cursor-text">
                نساعدك في زيادة ظهور موقعك في نتائج البحث وجذب عملاء حقيقيين لعملك
              </p>
              <div className="flex gap-4">
                <Button
                  onClick={() => setLocation('/register')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg"
                >
                  ابدأ الآن
                </Button>
                <Button
                  onClick={() => setLocation('/contact')}
                  variant="outline"
                  className="border-blue-600 text-blue-600 hover:bg-blue-50 px-8 py-3 text-lg"
                >
                  تواصل معنا
                </Button>
              </div>
            </div>
            <div className="relative">
              <img
                src={HERO_IMAGE}
                alt="SEO Services"
                className="w-full rounded-lg shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>
      
      {/* Services Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.div variants={containerVariants} initial="hidden" whileInView="visible" viewport={{ once: true }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service) => (
              <motion.div key={service.service_id} variants={itemVariants} onClick={() => setSelectedService(service)} className="cursor-pointer group">
                <Card id="seo" className="h-full p-8 hover:shadow-2xl transition-all duration-300 border-0 bg-white hover:bg-gradient-to-br hover:from-slate-50 hover:to-slate-100">
                  <div className={`inline-flex p-4 rounded-lg bg-gradient-to-r ${service.color} text-white mb-6 group-hover:scale-110 transition-transform`}>
                    {service.icon}
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">{service.service_name}</h3>
                  <p className="text-sm text-blue-600 font-semibold mb-4">{service.service_code || 'خدمة احترافية'}</p>
                  <p className="text-slate-600 mb-6 line-clamp-3">{service.description}</p>
                  <div className="flex items-center text-blue-600 font-semibold group-hover:gap-3 transition-all">
                    <Link to="home" smooth="true" duration={500}>اعرف المزيد</Link>
                    <ArrowRight className="w-4 h-4 mr-2 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Detailed Service View */}
      {selectedService && (
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
          <Element name="home"></Element>
          <div className="max-w-6xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                <div>
                  <div className={`inline-flex p-6 rounded-2xl bg-gradient-to-r ${selectedService.color} text-white mb-8`}>
                    {selectedService.icon}
                  </div>
                  <h2 className="text-4xl font-bold text-slate-900 mb-4">{selectedService.service_name}</h2>
                  <p className="text-lg text-slate-600 mb-8">{selectedService.description}</p>
                  <Card className="p-6 bg-white border-2 border-blue-200 mb-8">
                    <h4 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
                      <Award className="w-5 h-5 ml-2 text-yellow-500" />
                      دراسة حالة
                    </h4>
                    <p className="text-slate-600 mb-3"><strong>{selectedService.caseStudy?.title}</strong></p>
                    <div className="space-y-2">
                      <p className="text-green-600 font-semibold">{selectedService.caseStudy?.result}</p>
                      <p className="text-blue-600">{selectedService.caseStudy?.improvement}</p>
                    </div>
                  </Card>
                  <Button className="w-full bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white py-6 text-lg rounded-lg" onClick={() => setLocation('/register')}>
                    احصل على استشارة مجانية <Rocket className="w-5 h-5 mr-2" />
                  </Button>
                </div>
                <div className="space-y-6">
                  <div className="flex gap-4 mb-6">
                    <button onClick={() => setActiveTab('benefits')} className={`px-6 py-2 rounded-lg font-semibold transition-all ${activeTab === 'benefits' ? 'bg-white text-blue-600 shadow-md' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>الفوائد</button>
                    <button onClick={() => setActiveTab('features')} className={`px-6 py-2 rounded-lg font-semibold transition-all ${activeTab === 'features' ? 'bg-white text-blue-600 shadow-md' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>المميزات</button>
                  </div>
                  {activeTab === 'benefits' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                      {selectedService.benefitsList?.map((benefit, index) => (
                        <motion.div key={index} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }} className="flex items-start gap-4 p-4 bg-white rounded-lg border border-slate-200 hover:border-blue-300">
                          <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" />
                          <p className="text-slate-700">{benefit}</p>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                  {activeTab === 'features' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                      {selectedService.featuresList?.map((feature, index) => (
                        <motion.div key={index} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.1 }} className="flex items-start gap-4 p-4 bg-white rounded-lg border border-slate-200 hover:border-blue-300">
                          <Target className="w-6 h-6 text-blue-500 flex-shrink-0 mt-1" />
                          <p className="text-slate-700">{feature}</p>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* Why Choose Us */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <Element name="Us"></Element>
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-slate-900 mb-4">لماذا تختار ؟ SEO</h2>
            <p className="text-xl text-slate-600">نحن نقدم الأفضل في الصناعة</p>
          </motion.div>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {[
              { icon: <Users className="w-8 h-8" />, title: 'فريق خبراء', description: 'فريق محترف وذو خبرة متاح 24/7' },
              { icon: <Target className="w-8 h-8" />, title: 'استراتيجيات مخصصة', description: 'حلول مخصصة لكل عميل حسب احتياجاته' },
              { icon: <Award className="w-8 h-8" />, title: 'نتائج مضمونة', description: 'نتائج قابلة للقياس ومضمونة' },
              { icon: <BarChart3 className="w-8 h-8" />, title: 'تواصل شفاف', description: 'تحديثات منتظمة وتقارير شاملة' },
              { icon: <Rocket className="w-8 h-8" />, title: 'مدير مخصص', description: 'مدير مشروع مخصص لكل عميل' },
              { icon: <Zap className="w-8 h-8" />, title: 'أسعار معقولة', description: 'خدمات بأسعار مناسبة للجميع' },
            ].map((item, index) => (
              <motion.div key={index} variants={itemVariants}>
                <Card className="p-8 text-center hover:shadow-lg transition-shadow">
                  <div className="inline-flex p-4 rounded-lg bg-blue-100 text-blue-600 mb-6">
                    {item.icon}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
                  <p className="text-slate-600">{item.description}</p>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-gray-900 text-center mb-16">خطط الأسعار</h2>
          {loadingPackages ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">جاري تحميل الباقات...</p>
            </div>
          ) : packages.length === 0 ? (
            <div className="text-center py-12"><p className="text-gray-600">لا توجد باقات متاحة حالياً</p></div>
          ) : (
            <div className="grid md:grid-cols-3 gap-8">
              {packages.map((pkg, index) => {
                const isHighlighted = index === 1;
                const features = parseInclusions(pkg.included_services);
                return (
                  <Card key={pkg.package_id} className={`p-8 ${isHighlighted ? 'ring-2 ring-blue-600 shadow-lg' : ''}`}>
                    {isHighlighted && <div className="mb-4 inline-block bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">الأكثر شهرة</div>}
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{pkg.package_name}</h3>
                    <p className="text-sm text-gray-500 mb-4">{pkg.package_code}</p>
                    <p className="text-4xl font-bold text-blue-600 mb-4">${pkg.price.toLocaleString()}</p>
                    {pkg.duration_days && <p className="text-sm text-gray-500 mb-6">لمدة {pkg.duration_days} شهر</p>}
                    <p className="text-gray-600 mb-6 text-sm">{pkg.description}</p>
                    <ul className="space-y-3 mb-8">
                      {features.map((feature, i) => (
                        <li key={i} className="flex gap-2 text-gray-700">
                          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button onClick={() => setLocation('/register')} className={`w-full ${isHighlighted ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}>
                      اختر {pkg.package_name}
                    </Button>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </section>

    {/* Testimonials Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
         <div className="text-center mb-12">
           <h2 className="text-4xl font-bold text-gray-900 mb-4">آراء عملائنا</h2>
           <p className="text-xl text-gray-600">ما يقوله العملاء عن خدماتنا</p>
          </div>

    {/* إحصائيات التقييمات */}
    <div className="grid md:grid-cols-2 gap-8 mb-16">
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
        <div className="inline-flex p-3 bg-yellow-100 rounded-full mb-4">
          <Star className="w-8 h-8 text-yellow-500 fill-yellow-500" />
        </div>
        <div className="text-5xl font-bold text-gray-900 mb-2">
          {stats.average_rating ? stats.average_rating.toFixed(1) : '0'}
        </div>
        <div className="flex justify-center gap-1 mb-2">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className={`w-5 h-5 ${i < Math.round(stats.average_rating) ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`} />
          ))}
        </div>
        <p className="text-gray-600">بناءً على {stats.total_reviews} رأياً</p>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-8">
        <h3 className="text-xl font-bold mb-4">توزيع التقييمات</h3>
        {[5,4,3,2,1].map(star => {
          const count = stats[`${star}_star` as keyof typeof stats] as number || 0;
          const percent = stats.total_reviews ? (count / stats.total_reviews) * 100 : 0;
          return (
            <div key={star} className="flex items-center gap-3 mb-3">
              <div className="w-12 text-sm font-medium">{star} نجوم</div>
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${percent}%` }}></div>
              </div>
              <div className="w-12 text-sm text-gray-600">{count}</div>
            </div>
          );
        })}
      </div>
    </div>

    {/* عرض الآراء */}
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
      {testimonials.length === 0 ? (
        <div className="col-span-full text-center text-gray-500">لا توجد آراء حتى الآن، كن أول من يضيف رأياً!</div>
      ) : (
        testimonials.map((testimonial, index) => (
          <Card key={testimonial.id} className="p-6 hover:shadow-xl transition-shadow">
            <div className="flex gap-1 mb-4">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`w-5 h-5 ${i < testimonial.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
              ))}
            </div>
            <p className="text-gray-700 mb-4">"{testimonial.text}"</p>
            <p className="font-bold text-gray-900">{testimonial.name}</p>
            {testimonial.company && <p className="text-sm text-gray-600">{testimonial.company}</p>}
          </Card>
        ))
      )}
    </div>

    {/* زر فتح نموذج إضافة رأي */}
    <div className="text-center">
      <Dialog>
        <DialogTrigger asChild>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg rounded-full shadow-lg">
            أضف رأيك
            <Send className="w-5 h-5 mr-2" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[500px] bg-white rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">شاركنا رأيك</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitReview} className="space-y-6 mt-4">
            <div>
              <Label htmlFor="name">الاسم الكامل *</Label>
              <Input
                id="name"
                value={newReview.name}
                onChange={(e) => setNewReview({...newReview, name: e.target.value})}
                required
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="company">الشركة (اختياري)</Label>
              <Input
                id="company"
                value={newReview.company}
                onChange={(e) => setNewReview({...newReview, company: e.target.value})}
                className="mt-1"
              />
            </div>
            <div>
              <Label>التقييم *</Label>
              <RadioGroup
                value={newReview.rating}
                onValueChange={(val) => setNewReview({...newReview, rating: val})}
                className="flex gap-4 mt-2"
              >
                {[1,2,3,4,5].map(r => (
                  <div key={r} className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value={r.toString()} id={`rating-${r}`} />
                    <Label htmlFor={`rating-${r}`} className="flex gap-1">
                      {[...Array(r)].map((_,i) => <Star key={i} className="w-4 h-4 fill-yellow-500 text-yellow-500" />)}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            <div>
              <Label htmlFor="text">رأيك *</Label>
              <Textarea
                id="text"
                rows={4}
                value={newReview.comment}
                onChange={(e) => setNewReview({...newReview, comment: e.target.value})}
                required
                placeholder="اكتب تجربتك مع خدماتنا..."
                className="mt-1"
              />
            </div>
            {reviewMessage && (
              <div className={`p-3 rounded-lg text-center ${reviewMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {reviewMessage.comment}
              </div>
            )}
            <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700">
              {isSubmitting ? 'جاري الإرسال...' : 'إرسال الرأي'}
            </Button>
            <p className="text-xs text-center text-gray-500">سيتم مراجعة رأيك قبل النشر</p>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  </div>
</section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">هل أنت مستعد لتحسين موقعك؟</h2>
          <p className="text-xl mb-8 opacity-90">انضم إلى مئات الشركات التي حققت نجاحاً مع SEO</p>
          <Button
            onClick={() => setLocation('/register')}
            className="bg-white text-blue-600 hover:bg-gray-100 px-8 py-3 text-lg font-semibold"
          >
            ابدأ الآن مجاناً
            <ArrowRight className="w-5 h-5 mr-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="text-white font-bold mb-4">SEO</h3>
              <p>خدمات تحسين محركات البحث الاحترافية</p>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">الخدمات</h4>
              <ul className="space-y-2">
                <li><Link to="seo" smooth="true" duration={700}>تحسين SEO</Link></li>
                <li><Link to="home" smooth="true" duration={700}>تحليل البيانات</Link></li>
                <li><a href="#" className="hover:text-white">إدارة المحتوى</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">الشركة</h4>
              <ul className="space-y-2">
                <li><Link to="Us" smooth="true" duration={500}>عن الشركة</Link></li>
                <li><a href="#" className="hover:text-white">المدونة</a></li>
                <li><button onClick={() => setLocation('/contact')} className="hover:text-white cursor-pointer">تواصل معنا</button></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">التواصل</h4>
              <p>البريد: support@seo.com</p>
              <p>+249 11 970 6815</p>
              <p>+249 11 111 1123</p>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center">
            <p>© {new Date().getFullYear()} SEO. جميع الحقوق محفوظة.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}