import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import {
  detectListingChanges,
  type ComparableListing,
  type ListingChange,
} from '../domain/listing-changes.ts';

const ListingChangeState = Annotation.Root({
  existingListings: Annotation<ComparableListing[]>(),
  incomingListings: Annotation<ComparableListing[]>(),
  changes: Annotation<ListingChange[]>({ default: () => [], reducer: (_, update) => update }),
  changedListingIds: Annotation<string[]>({ default: () => [], reducer: (_, update) => update }),
});

const listingChangeGraph = new StateGraph(ListingChangeState)
  .addNode('detectChanges', (state) => ({
    changes: detectListingChanges(state.existingListings, state.incomingListings),
  }))
  .addNode('collectAffectedListings', (state) => ({
    changedListingIds: state.changes.map((change) => change.sourceListingId),
  }))
  .addEdge(START, 'detectChanges')
  .addEdge('detectChanges', 'collectAffectedListings')
  .addEdge('collectAffectedListings', END)
  .compile();

export async function runListingChangeWorkflow(
  existingListings: ComparableListing[],
  incomingListings: ComparableListing[],
) {
  return listingChangeGraph.invoke({ existingListings, incomingListings });
}
