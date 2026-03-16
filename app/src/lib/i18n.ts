export function useTranslation() {
  return {
    t: (key: string, options?: { defaultValue?: string }) => {
      if (options?.defaultValue) return options.defaultValue;
      return key.split('.').pop() || key;
    }
  };
}