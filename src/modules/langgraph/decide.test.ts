import { call } from "./decide";

describe("LangGraph", () => {
  it("should respond with a joke", async () => {
    const res = await call("What is the meaning of life?");

    expect(res).toContain("Here's a joke...");

    console.log(res);
  });

  it("should use the vector search tool", async () => {
    const res = await call(
      "Can you recommend a Talk that uses humour to convey a point?"
    );

    expect(res).not.toContain("Here's a joke...");

    console.log(res);
  });

  it("should use the database tool", async () => {
    const res = await call("How many talks mention JavaScript?");

    expect(res).not.toContain("Here's a joke...");

    console.log(res);
  });
});
