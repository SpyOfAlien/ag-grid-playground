import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

/**
 * PrimeNG's Aura theme in the Signal List Management brand teal (Figma: utility-brand-700
 * #004e50, text-brand-primary #003133, utility-brand-50_alt #e0f3f3), so PrimeNG components match
 * the signal grid's dialogs, inputs and menus.
 */
export const SignalPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#f1fafa',
      100: '#e0f3f3',
      200: '#c0e6e6',
      300: '#8fd0d1',
      400: '#4fa9ab',
      500: '#005e60',
      600: '#004e50',
      700: '#004244',
      800: '#003133',
      900: '#002628',
      950: '#001718',
    },
  },
});
