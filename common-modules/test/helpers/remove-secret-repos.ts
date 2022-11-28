import {Command} from 'commander'
import { expect } from 'chai';
import logger from "../../src/logger"
import {getOrgSecretAssignedRepos, getOrgRepos, orgReposIDs, removeRepoFromSecret} from "../../src/org"

const run = async () => {
    logger.info('Asserting secret\'s team association');
    const program = new Command();
    program.requiredOption('-o, --org-name <type>', 'Organization name')
    program.requiredOption('-s, --secret-name <type>', 'Secret to assert')
    program.requiredOption('-r, --repos-revoked <type...>', 'Repos to revoke the secret from')
    program.parse(process.argv);
    const options = program.opts();
    const {orgName, secretName, reposRevoked} = options;
    try {
        const orgRepos = (await orgReposIDs(orgName));
        const responses=await reposRevoked.reduce(async (currentResponses, repoName)=>{
            await (currentResponses);
            const repoId=orgRepos[repoName];
            return removeRepoFromSecret(orgName,secretName, repoId);
        },Promise.resolve({}))

        logger.info(`Done revoking secrets for repos ${JSON.stringify(responses)}`);
        return responses;

    } catch (error){
        logger.error(`Error ${error}`);
        if (error.status!=404) {
            logger.info('Repos for secrets revoke were not found');
            process.exit(1);
        }
    }

}

run();