export const leadService = {
  async submit(payload) {
    await new Promise((resolve) => setTimeout(resolve, 80))
    return { status: 'demo', email: payload.email }
  },
}
