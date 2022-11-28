import {Command} from 'commander';
import logger from "./logger"
import {validateRepoStandard} from "./repos"
import * as fs from "fs";

const trim = (value) => value.trim();

async function validateRepo() {
    if (process.env.NODE_ENV === 'CI') {
        logger.level = "info";
    }
    const program = new Command();
    program.requiredOption('-r, --repo-name <type>', 'Repository name to validate', trim)
    program.parse(process.argv);
    const options = program.opts();
    const {repoName} = options;
    if (repoName) {
        try {
            const result = await validateRepoStandard(repoName);
            return result ? result : Promise.reject(`Wrong name pattern`);
        } catch (error) {
            return Promise.reject(error);
        }
    }
    const errorMsg=`Repository not provided`;
    return Promise.reject(errorMsg);;
}

async function run() {
    try {
        await validateRepo();
        logger.info("Success.")
        process.exit(0);
    } catch (error) {
        logger.error(error);
        process.exit(1);
    }

}
run();


