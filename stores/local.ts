import { defineStore } from "pinia";

// export const useLocalStore = defineStore("local", {
//   state: () => ({
//     currentLocale: "th",
//   }),
//   actions: {
//     // สร้าง action สำหรับเปลี่ยนภาษาโดยเฉพาะ
//     switchLanguage(newLocale: string) {
//       const { $setLocale } = useNuxtApp(); // ดึง $setLocale จาก nuxt-i18n-micro

//       this.currentLocale = newLocale;
//       $setLocale(newLocale); // สั่ง i18n-micro ให้เปลี่ยนภาษา
//     },
//   },
//   persist:true
//   // persist: {
//   //   key: "payiq-local",
//   //   storage: persistedState.localStorage,
//   // },
// });


// export const useLocalStore = defineStore('local', {
//   state: () => ({
//     currentLocale: 'th',
//   }),
//   actions: {
//     switchLanguage(newLocale: string) {
//       this.currentLocale = newLocale

//       // ดึงฟังก์ชันจาก useNuxtApp
//       const { $i18n } = useNuxtApp() 

//       // ตรวจสอบชื่อฟังก์ชันที่ถูกต้องของ i18n-micro
//       // ปกติจะเป็น $i18n.setLocale หรือ $setLocale
//       if ($i18n && typeof ($i18n as any).setLocale === 'function') {
//         ($i18n as any).setLocale(newLocale)
//       } else {
//         // ถ้าหา $i18n.setLocale ไม่เจอ ให้ลองใช้ useI18n (ถ้า Nuxt ยอมให้ใช้ใน Store)
//         console.warn('i18n setLocale not found, check your configuration')
//       }
//     },
//   },
//   persist: true
// })


export const useLocalStore = defineStore('local', {
  state: () => ({
    // ค่าเริ่มต้นถ้าไม่มีใน storage
    currentLocale: 'th',
  }),
  actions: {
    // ฟังก์ชันนี้จะถูกเรียกจาก Layout หรือ Pages
    setLanguage(newLocale: string) {
      this.currentLocale = newLocale
      // console.log('Language set in Pinia store:', this.currentLocale) // Debug log
    },
  },
  // บันทึกลง localStorage อัตโนมัติในชื่อ 'payiq-local'
  persist:true
})