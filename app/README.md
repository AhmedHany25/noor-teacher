# نور القرآن — أداة المعلم (التطبيق الجديد)

المواصفات الكاملة في [SPEC.md](SPEC.md).

## التشغيل

```bash
npm install
npm run dev        # خادم التطوير على http://localhost:5173
npm test           # الاختبارات في وضع المراقبة
npm run check      # فحص الأنواع + كل الاختبارات مرة واحدة
npm run build      # بناء نسخة النشر في dist/
npm run preview    # تشغيل نسخة النشر محليًا (مع Service Worker)
```

## النشر على Firebase Hosting

مرة واحدة فقط: `npx firebase-tools login`

ثم في كل نشر:

```bash
npm run check && npm run build && npx firebase-tools deploy --only hosting
```

## البنية

- `src/domain/` منطق الحساب كدوال TypeScript نقية، ولكل دالة اختبارات.
- `src/lib/` أدوات عامة (تنسيق الأرقام والتواريخ).
- `src/screens/` الشاشات.
- `src/components/` مكونات مشتركة.
