export const pmsService = {
  async connect() {
    await new Promise((resolve) => setTimeout(resolve, 80))
    return { status: 'demo' }
  },
}
