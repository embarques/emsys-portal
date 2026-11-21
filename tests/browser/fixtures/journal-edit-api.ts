type FixtureState = Window & { editCalls: {url: string; body: unknown; method: string}[]; failCorrection?: boolean };
const record = (method: string, url: string, body: unknown) => {
  const state = window as unknown as FixtureState;
  state.editCalls ??= [];
  state.editCalls.push({method,url,body});
  return state;
};
export const apiClient = {
  put: async (url: string, body: unknown) => { record("PUT",url,body); return {success:true,data:{id:"original",transactionType:"SALES",transactionAmount:105}}; },
  post: async (url: string, body: unknown) => {
    const state = record("POST",url,body);
    if (state.failCorrection) { state.failCorrection = false; throw new Error("Temporary correction failure"); }
    return {success:true,data:{id:"offset",replacement:{id:"replacement",transactionType:"SALES",transactionAmount:105}}};
  },
};
