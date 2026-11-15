import { AdminRepository } from "./admin.repository.js";
import { ListUsersDTO } from "./admin.validator.js";

export class AdminService {
    constructor(
        private readonly adminRepository: AdminRepository,
    ) {}

    async getDashboardStats() {
        return this.adminRepository.getDashboardStats();
    }

    async getUsers(query: ListUsersDTO) {
    return this.adminRepository.getUsers(query);
}
}