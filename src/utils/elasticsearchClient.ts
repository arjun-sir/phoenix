import { Client } from "@elastic/elasticsearch";
import type { Gadget } from "@prisma/client";

const client = new Client({
  node: process.env.ELASTICSEARCH_URL || "http://elasticsearch:9200",
});

const GADGET_INDEX = "gadgets";

export async function initializeElasticsearch() {
  const indexExists = await client.indices.exists({ index: GADGET_INDEX });

  if (!indexExists) {
    await client.indices.create({
      index: GADGET_INDEX,
      mappings: {
        properties: {
          id: { type: "keyword" },
          name: { type: "text" },
          status: { type: "keyword" },
          userId: { type: "keyword" },
          createdAt: { type: "date" },
          DecommissionedAt: { type: "date" },
        },
      },
    });
  }
}

export const indexGadget = (gadget: Gadget) =>
  client.index({
    index: GADGET_INDEX,
    id: gadget.id,
    document: gadget,
  });

export const searchGadgets = async (query: string, userId: string) => {
  const result = await client.search<Gadget>({
    index: GADGET_INDEX,
    query: {
      bool: {
        must: [
          {
            multi_match: {
              query,
              fields: ["name^2", "status"],
            },
          },
          { term: { userId } },
        ],
      },
    },
  });

  return result.hits.hits.map((hit) => ({
    ...(hit._source as Gadget),
    score: hit._score,
  }));
};

export const deleteGadgetFromIndex = (gadgetId: string) =>
  client.delete({
    index: GADGET_INDEX,
    id: gadgetId,
  });
