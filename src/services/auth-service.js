export const authService = {
  async createAccount(payload) {
    await new Promise((resolve) => setTimeout(resolve, 180))
    if (payload.email?.includes('+fail@')) throw new Error('Could not create account. Please try again.')
    return {
      id: `demo_${Date.now()}`,
      clinicName: payload.clinicName,
      firstName: payload.firstName,
      lastName: payload.lastName,
      jobTitle: payload.jobTitle,
      email: payload.email,
      locations: payload.locations,
    }
  },
}
