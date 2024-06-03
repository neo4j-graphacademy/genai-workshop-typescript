import { Neo4jGraph } from "@langchain/community/graphs/neo4j_graph";
import { buildGraph, call } from ".";

describe("LangGraph", () => {
  // it("should use the increment tool", async () => {
  //   const res = await call("I want to increment up to 5");
  //   expect(res).toEqual("The final number is 5.");
  // });

  // it("should use the decrement tool", async () => {
  //   const res = await call("I want to decrement from to 5 to 1");
  //   expect(res).toEqual("The number went from 5 to 1.");
  // });

  // it("should use semantic search tool", async () => {
  //   const res = await call("Can you recommend a talk about Next.js?");
  //   expect(res).toContain(
  //     "Scaling Heights: Highly scalable architecture with Next.js"
  //   );
  //   expect(res).toContain("Nemanja Drobnjak");
  // });

  // it("should use the database tool", async () => {
  //   // const res = await call("What is the title of the talk by Sylwia Vargas?");
  //   // expect(res).toContain("Sylwia Vargas");
  //   // expect(res).toContain("Improving app performance by using background jobs");

  //   const res = await call("how many talks are tagged as javascript?");
  //   expect(res).toContain("4");
  // });

  // it("should use the guardrail", async () => {
  //   const res = await call("what is the meaning of life?");
  //   expect(res).toContain("Guardrails");
  //   console.log(res);
  // });

  it("should answer a question about the weather", async () => {
    const res = await call("what is the weather going to be?");
    expect(res).toContain("hot");
    console.log(res);
  });

  // TODO: weather

  // it("should do something", async () => {
  //   const app = await buildGraph();
  //   expect(app).toBeDefined();

  //   // const res = await app.invoke({
  //   //   input: "how many talks are being delivered by Adam Cowley?",
  //   // });
  //   // const res = await app.invoke({
  //   //   input: "how many talks are tagged as javascript?",
  //   // });
  //   // const res = await app.invoke({
  //   //   input: "how many talks are tagged with serverless?",
  //   // });
  //   // const res = await app.invoke({
  //   //   input: "what is the title of the talk by Katerina Skroumpelou?",
  //   // });
  //   // const res = await app.invoke({
  //   //   input: "Which room is the talk by Adam Cowley taking place in?",
  //   // });
  //   // const res = await app.invoke({
  //   //   input: "what is the meaning of life?",
  //   // });
  //   // const res = await app.invoke({
  //   //   input: "Can you recommend a talk on serverless?",
  //   // });
  //   // const res = await app.invoke({
  //   //   input: "I want to decrement from to 5 to 1",
  //   // });

  //   // console.log(JSON.stringify(res, null, 2));
  //   // console.log(res.agentOutcome.returnValues.output);
  // });
});
