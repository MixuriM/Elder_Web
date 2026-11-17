// Valor de <input type="datetime-local"> (AAAA-MM-DDTHH:mm, hora do navegador) a partir de um instante ISO.
// Vai e volta com `new Date(valor).toISOString()`, que é o que os formulários de registro já fazem.
export function paraInputDataHora(iso: string): string {
  const d = new Date(iso)

  if (Number.isNaN(d.getTime())) return ''

  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
