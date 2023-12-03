export interface InsertOpp {
    hotelId: number; 
    // startDate: Date;  
    // endDate: Date;
    startDateStr: string;
    endDateStr: string;
    boardlId: number; 
    categorylId: number; 
    buyPrice: number; 
    pushPrice: number; 
    maxRooms: number; 
    ratePlanCode: string;
    invTypeCode: string;
    reservationFullName: string;
}