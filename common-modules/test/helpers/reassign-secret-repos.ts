import {Command} from 'commander'
import { expect } from 'chai';
import logger from "../../src/logger"
import {getOrgSecretAssignedRepos, getOrgRepos, orgReposIDs, setReposToSecret} from "../../src/org"

const run = async () => {
    logger.info('Re-assigning secret\'s team association');
    const program = new Command();
    program.requiredOption('-o, --org-name <type>', 'Organization name')
    program.requiredOption('-s, --secret-name <type>', 'Secret to assert')
    program.option('-r, --repos-assigned [type...]', 'Repos to assign the secret to')
    program.parse(process.argv);
    const options = program.opts();
    const {orgName, secretName, reposAssigned = []} = options;
    try {
        const orgRepos = await orgReposIDs(orgName);
        const assignedRepoIds = reposAssigned.map(repoName => orgRepos[repoName]);
        const response=await setReposToSecret(orgName,secretName, assignedRepoIds);

        logger.info(`Done re-assigning secrets for repos ${JSON.stringify(response)}`);

    } catch (error){
        logger.error(`Error ${error}`);
        if (error.status!=404) {
            process.exit(1);
        }
    }

}

run();