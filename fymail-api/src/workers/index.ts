import { getQueue } from "../services/queue.service";
import {
  registerSendEmailWorker,
  registerProcessCampaignWorker,
} from "./send-email.worker";

export async function startWorkers() {
  const boss = await getQueue();

  await registerSendEmailWorker(boss);
  await registerProcessCampaignWorker(boss);

  console.log("[workers] All workers registered");
}
